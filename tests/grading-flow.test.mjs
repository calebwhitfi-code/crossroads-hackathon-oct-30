import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPrismaClient } from "../prisma/client.mjs";
import { startBrowser, waitFor } from "./browser.mjs";
import { fixtures } from "./fixtures.mjs";
import { pageTools, plain, startApp } from "./harness.mjs";

let directory;
let db;
let server;
let baseUrl;
let browser;
let serverOutput = "";

const run = (script, args = []) => execFileSync(process.execPath, [script, ...args], { env: process.env, encoding: "utf8", stdio: "pipe" });

before(async () => {
  directory = mkdtempSync(join(tmpdir(), "homestead-grading-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
  run("prisma/seed.mjs");
  db = createPrismaClient();
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "0"], {
    env: { ...process.env, GRADER: "mock", NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk;
    const match = serverOutput.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
    if (match) baseUrl = `http://127.0.0.1:${match[1]}`;
  });
  server.stderr.on("data", (chunk) => { serverOutput += chunk; });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !(baseUrl && (await fetch(baseUrl).catch(() => null))?.ok)) await delay(100);
  assert.ok(baseUrl, `Test server did not start:\n${serverOutput}`);
  browser = await startBrowser();
}, { timeout: 60_000 });

after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    await exited;
  }
  await db?.$disconnect();
  if (directory) {
    for (const name of readdirSync(directory)) rmSync(join(directory, name));
    rmdirSync(directory);
  }
});

const setValue = async (selector, text) => {
  await waitFor(() => browser.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`));
  return browser.evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(text)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
})()`);
};
const submit = async (form) => { await delay(1000); await browser.evaluate(`document.querySelector('form[data-form="${form}"]').requestSubmit()`); };
const pathIs = (fragment) => waitFor(async () => (await browser.evaluate("location.pathname")).includes(fragment));

test("rubric, photo grading, validation and parent approval work end to end", async () => {
  await browser.navigate(`${baseUrl}/rubrics`);
  await setValue('input[name="name"]', "Essay rubric");
  await setValue('input[name="name0"]', "Thesis");
  await setValue('input[name="maxPoints0"]', "10");
  await setValue('input[name="name1"]', "Grammar");
  await setValue('input[name="maxPoints1"]', "5");
  await submit("rubric");
  await waitFor(async () => (await browser.evaluate("document.body.innerText")).includes("Essay rubric"));
  const rubric = await db.rubric.findFirst({ where: { name: "Essay rubric" }, include: { criteria: true } });
  assert.equal(rubric.familyId, "family-parker");
  assert.equal(rubric.criteria.length, 2);

  const assignment = await db.assignment.findFirst({ where: { course: { student: { familyId: "family-parker" } } } });
  const before = await db.submission.count({ where: { assignmentId: assignment.id } });
  await browser.navigate(`${baseUrl}/assignments/${assignment.id}/grade`);
  const attach = (name, type, bytes) => browser.evaluate(`(() => {
    const input = document.querySelector('input[name="photo"]');
    const transfer = new DataTransfer();
    transfer.items.add(new File([Uint8Array.from(atob(${JSON.stringify(Buffer.from(bytes).toString("base64"))}), (c) => c.charCodeAt(0))], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} }));
    input.files = transfer.files;
  })()`);

  await attach("notes.png", "image/png", fixtures.notAnImage());
  await submit("photo-grade");
  await waitFor(async () => (await browser.evaluate("document.body.innerText")).includes("JPEG, PNG, GIF, or WebP image"));
  assert.equal(await db.submission.count({ where: { assignmentId: assignment.id } }), before);

  const png = fixtures.worksheet();
  await attach("work.png", "image/png", png);
  await submit("photo-grade");
  await pathIs("/reviews/");
  const pending = await db.submission.findFirst({
    where: { assignmentId: assignment.id, source: "vision" }, include: { criteriaScores: true },
  });
  assert.equal(pending.status, "pending_review");
  assert.equal(pending.earnedPoints, null);
  assert.equal(pending.image, null);
  assert.equal(pending.gradingProvider, "mock");
  assert.match(await browser.evaluate("document.body.innerText"), /Mock grader \/ simulated results/);
  assert.equal(pending.criteriaScores.length, 2);
  assert.ok(pending.criteriaScores.every((score) => score.earnedPoints <= score.maxPoints && score.description));

  await setValue('input[name="earnedPoints"]', String(assignment.maxPoints + 1));
  await browser.evaluate('document.querySelector(\'form[data-form="approve"]\').noValidate = true');
  await delay(1000);
  await browser.evaluate(`document.querySelector('form[data-form="approve"] button[name="approve"]').click()`);
  await waitFor(async () => (await browser.evaluate("document.body.innerText")).includes("between 0 and"));
  assert.equal((await db.submission.findUnique({ where: { id: pending.id } })).status, "pending_review");

  await setValue('input[name="earnedPoints"]', "1");
  await delay(1000);
  await browser.evaluate(`document.querySelector('form[data-form="approve"] button[name="approve"]').click()`);
  await pathIs("/reviews");
  await waitFor(async () => (await db.submission.findUnique({ where: { id: pending.id } })).status === "approved");
  const approved = await db.submission.findUnique({ where: { id: pending.id } });
  assert.equal(approved.earnedPoints, 1);
  assert.ok(approved.approvedAt);
});

test("transcript lists completed courses, hides from other students, and prints cleanly", async () => {
  const course = await db.course.create({
    data: {
      studentId: "student-ava", name: "Transcript Test Course", subject: "Science", credits: 1, gradeLevel: 10,
      academicYear: "2026-2027", completed: true,
      assignments: { create: { title: "Final", maxPoints: 100, submissions: { create: { feedback: "", status: "approved", earnedPoints: 92, letterGrade: "A", approvedAt: new Date() } } } },
    },
  });

  const html = async (path, cookie) => (await fetch(`${baseUrl}${path}`, { headers: cookie ? { cookie } : {} }));
  const page = await html("/transcripts/student-ava");
  assert.equal(page.status, 200);
  const text = (await page.text()).replaceAll("<!-- -->", "");
  assert.match(text, /Transcript Test Course/);
  assert.match(text, /A \/ 92\.0%/);
  assert.match(text, new RegExp(`/courses/${course.id}/edit`));

  const own = await html("/transcripts/student-ava", "homeschool-demo-profile=student:student-ava");
  const ownText = (await own.text()).replaceAll("<!-- -->", "");
  assert.match(ownText, /Transcript Test Course/);
  assert.doesNotMatch(ownText, /\/edit/);
  for (const [path, cookie] of [["/transcripts/student-noah", "homeschool-demo-profile=student:student-ava"], ["/transcripts/student-elena", ""]]) {
    const hidden = await (await html(path, cookie)).text();
    assert.doesNotMatch(hidden, /Official homeschool transcript/);
    assert.match(hidden, /NEXT_HTTP_ERROR_FALLBACK;404|not-found|could not be found|404/i);
  }

  await browser.navigate(`${baseUrl}/transcripts/student-ava`);
  const sheet = await browser.evaluate(`document.querySelector('.transcript-sheet').innerText`);
  assert.match(sheet, /Transcript Test Course/);
  await browser.command("Emulation.setEmulatedMedia", { media: "print" });
  try {
    const layout = await browser.evaluate(`(() => ({
      aside: getComputedStyle(document.querySelector('aside')).display,
      button: [...document.querySelectorAll('button')].every((b) => b.offsetParent === null),
      signature: getComputedStyle(document.querySelector('.print-only')).display,
      sheetLeft: Math.round(document.querySelector('.transcript-sheet').getBoundingClientRect().left),
    }))()`);
    assert.equal(layout.aside, "none");
    assert.equal(layout.signature, "block");
    assert.ok(layout.sheetLeft < 40, `sheet should start at the left edge, got ${layout.sheetLeft}`);
    assert.equal(layout.button, true);
  } finally {
    await browser.command("Emulation.setEmulatedMedia", { media: "" });
  }
});

test("missing AI key shows a clear mock fallback that stays pending and preserves provider provenance", async () => {
  const fallback = await startApp({ env: { GRADER: "ai", ANTHROPIC_API_KEY: "" }, prefix: "homestead-ai-fallback-" });
  try {
    await fallback.db.rubric.create({ data: {
      familyId: "family-parker", name: "Fallback rubric", description: "Test",
      criteria: { create: { name: "Accuracy", description: "Correct answers", maxPoints: 10, position: 0 } },
    } });
    const assignment = await fallback.db.assignment.findFirst({ where: { course: { studentId: "student-ava" } } });
    const approvedBefore = await fallback.db.submission.count({ where: { status: "approved" } });
    const tools = pageTools(browser, fallback.baseUrl);
    await tools.go(`/assignments/${assignment.id}/grade`);
    await tools.bodyHas("ANTHROPIC_API_KEY is missing");
    await tools.attach("sample.png", "image/png", fixtures.worksheet());
    await tools.bodyHas("Suggested grade created");
    const suggestion = await fallback.db.submission.findFirst({ where: { assignmentId: assignment.id, source: "vision" } });
    assert.equal(suggestion.status, "pending_review");
    assert.equal(suggestion.earnedPoints, null);
    assert.equal(suggestion.approvedAt, null);
    assert.equal(suggestion.image, null);
    assert.equal(suggestion.gradingProvider, "mock");
    assert.match(suggestion.gradingNotice, /ANTHROPIC_API_KEY is missing/);
    assert.equal(await fallback.db.submission.count({ where: { status: "approved" } }), approvedBefore);
    await tools.bodyHas("Mock grader / simulated results");
    await tools.bodyHas("ANTHROPIC_API_KEY is missing");
    const queue = plain((await fallback.get("/reviews")).text);
    assert.match(queue, /Mock grader \/ simulated results/);
    assert.match(queue, /ANTHROPIC_API_KEY is missing/);
    const student = await fallback.get("/work", "student:student-ava");
    assert.doesNotMatch(student.text, /Fallback rubric|ANTHROPIC_API_KEY is missing/);
  } finally {
    await fallback.stop();
  }
});

test("review screens show a saved AI provider even when the current configuration is mock", async () => {
  const assignment = await db.assignment.findFirst({ where: { course: { studentId: "student-ava" } } });
  const suggestion = await db.submission.create({ data: {
    assignmentId: assignment.id, source: "vision", gradingProvider: "ai",
    status: "pending_review", suggestedGrade: "8", feedback: "AI fixture feedback.",
  } });
  for (const path of ["/reviews", `/reviews/${suggestion.id}`]) {
    const text = plain(await (await fetch(`${baseUrl}${path}`)).text());
    assert.match(text, /AI grader \/ Anthropic/);
  }
});
