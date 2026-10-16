import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPrismaClient } from "../prisma/client.mjs";

let directory;
let db;
let server;
let baseUrl;
let serverOutput = "";

function run(script, args = []) {
  return execFileSync(process.execPath, [script, ...args], {
    env: process.env,
    encoding: "utf8",
    stdio: "pipe",
  });
}

before(async () => {
  directory = mkdtempSync(join(tmpdir(), "homestead-test-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
  run("prisma/seed.mjs");
  db = createPrismaClient();

  server = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "0",
  ], { env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk;
    const match = serverOutput.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
    if (match) baseUrl = `http://127.0.0.1:${match[1]}`;
  });
  server.stderr.on("data", (chunk) => { serverOutput += chunk; });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Test server exited:\n${serverOutput}`);
    if (baseUrl) {
      try {
        const response = await fetch(baseUrl);
        if (response.ok) return;
      } catch (error) {
        if (error.cause?.code !== "ECONNREFUSED") throw error;
      }
    }
    await delay(100);
  }
  throw new Error(`Test server did not become ready:\n${serverOutput}`);
}, { timeout: 45_000 });

after(async () => {
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

test("seed establishes the required families, learners, courses and approved grades", async () => {
  assert.equal(await db.family.count(), 2);
  assert.equal(await db.student.count(), 3);
  assert.equal(await db.course.count(), 8);
  assert.equal(await db.assignment.count(), 8);
  const submissions = await db.submission.findMany({
    include: { assignment: { include: { course: { include: { student: true } } } } },
  });
  assert.equal(submissions.length, 8);
  for (const submission of submissions) {
    assert.equal(submission.source, "manual");
    assert.equal(submission.status, "approved");
    assert.ok(submission.approvedAt);
    assert.ok(submission.earnedPoints >= 0 && submission.earnedPoints <= submission.assignment.maxPoints);
    assert.ok(["A", "B"].includes(submission.letterGrade));
    assert.ok(submission.assignment.course.student.familyId);
  }
  assert.equal(await db.course.count({ where: { weighted: true } }), 2);
  assert.equal(await db.course.count({ where: { curriculum: { not: null } } }), 8);
  assert.equal((await db.course.findUniqueOrThrow({
    where: { id: "ava-algebra" },
  })).curriculum, "Saxon Math - Algebra 2");
});

test("seed is repeatable and preserves existing work", async () => {
  await db.submission.update({
    where: { id: "ava-english-submission" },
    data: { feedback: "Parent's revised feedback." },
  });
  await db.course.update({
    where: { id: "ava-english" },
    data: { curriculum: "Parent's custom curriculum" },
  });
  await db.course.update({
    where: { id: "ava-biology" },
    data: { curriculum: null },
  });
  run("prisma/seed.mjs");
  assert.equal(await db.course.count(), 8);
  assert.equal(await db.submission.count(), 8);
  assert.equal((await db.submission.findUniqueOrThrow({
    where: { id: "ava-english-submission" },
  })).feedback, "Parent's revised feedback.");
  assert.equal((await db.course.findUniqueOrThrow({
    where: { id: "ava-english" },
  })).curriculum, "Parent's custom curriculum");
  assert.equal((await db.course.findUniqueOrThrow({
    where: { id: "ava-biology" },
  })).curriculum, "Apologia Biology");
});

test("new vision submissions default to pending review with no approved grade", async () => {
  const submission = await db.submission.create({
    data: {
      assignmentId: "ava-english-assignment",
      source: "vision",
      suggestedGrade: "A",
      feedback: "Suggested feedback awaiting parent review.",
    },
  });
  try {
    assert.equal(submission.status, "pending_review");
    assert.equal(submission.letterGrade, null);
    assert.equal(submission.earnedPoints, null);
    assert.equal(submission.approvedAt, null);
  } finally {
    await db.submission.delete({ where: { id: submission.id } });
  }
});

async function page(path = "/", profile) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: profile ? { cookie: `homeschool-demo-profile=${encodeURIComponent(profile)}` } : {},
  });
  return { response, html: await response.text() };
}

test("overview and course navigation render the selected family's records", async () => {
  const { response, html } = await page();
  assert.equal(response.status, 200);
  assert.match(html, /Parker Family/);
  assert.match(html, /Meet your learners/);
  assert.match(html, /Ava<!-- --> <!-- -->Parker/);
  assert.match(html, /Noah<!-- --> <!-- -->Parker/);
  assert.doesNotMatch(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "", /Elena<!-- --> <!-- -->Rivera/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /No sign-in or access control/);
  assert.match(html, /name="profile"/);

  const courses = await page("/courses");
  assert.equal(courses.response.status, 200);
  assert.match(courses.html, /English II/);
  assert.match(courses.html, /Pre-Algebra/);
  assert.match(courses.html, /<h3\b[^>]*>Algebra II<\/h3><p\b[^>]*>Saxon Math - Algebra 2<\/p>/);
  assert.match(courses.html, /<h3\b[^>]*>U.S. History<\/h3><p\b[^>]*>Notgrass History - America the Beautiful<\/p>/);
  assert.doesNotMatch(courses.html, /American Literature/);
});

test("student and second-family profiles select only their own visible courses", async () => {
  const student = await page("/courses", "student:student-ava");
  assert.match(student.html, /Student view/);
  assert.match(student.html, /English II/);
  assert.doesNotMatch(student.html, /Pre-Algebra/);
  assert.match(student.html, /Saxon Math - Algebra 2/);
  assert.doesNotMatch(student.html, /Notgrass History/);
  assert.doesNotMatch(student.html, /American Literature/);

  const rivera = await page("/courses", "parent:family-rivera");
  assert.match(rivera.html, /American Literature/);
  assert.match(rivera.html, /Chemistry/);
  assert.doesNotMatch(rivera.html, /English II/);
  assert.doesNotMatch(rivera.html, /Pre-Algebra/);
});

test("profile picker has a disclosure trigger and five numbered, working profile choices", async () => {
  const { html } = await page();
  assert.match(html, /<details\b/);
  assert.match(html, /<summary\b[^>]*>Switch profile/);
  assert.doesNotMatch(html, /<select\b/);
  const choices = [...html.matchAll(/<button\b[^>]*name="profile"[^>]*>[\s\S]*?<\/button>/g)];
  assert.equal(choices.length, 5);
  for (const [index, choice] of choices.entries()) {
    assert.match(choice[0], /type="submit"/);
    assert.match(choice[0], /value="(?:parent|student):[^"]+"/);
    assert.match(choice[0], new RegExp(`aria-hidden="true"[^>]*>${index + 1}</span>`));
  }
  assert.match(choices[0][0], /aria-current="true"/);
});

test("Home, the home logo, and every rendered navigation link lead to working pages", async () => {
  const { html } = await page("/courses");
  const anchors = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)];
  assert.ok(anchors.some(([anchor, href]) => href === "/" && /Homestead home/.test(anchor)));
  assert.ok(anchors.some(([anchor, href]) => href === "/" && />Home<\/a>/.test(anchor)));
  assert.ok(anchors.some(([anchor, href]) => href === "/courses" && /aria-current="page"/.test(anchor)));
  for (const href of new Set(anchors.map(([, href]) => href).filter((href) => href.startsWith("/")))) {
    const linked = await page(href);
    assert.equal(linked.response.status, 200, `${href} must lead to a working page`);
    if (href === "/") assert.match(linked.html, /Meet your learners/);
  }
});

function decodeAttribute(value) {
  return value.replaceAll("&quot;", '"').replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

async function submitProfile(value, path = "/") {
  const { html } = await page(path);
  const form = new FormData();
  for (const match of html.matchAll(/<input\b[^>]*>/g)) {
    const name = match[0].match(/\bname="([^"]+)"/)?.[1];
    const inputValue = match[0].match(/\bvalue="([^"]*)"/)?.[1];
    if (name?.startsWith("$ACTION_")) form.append(decodeAttribute(name), decodeAttribute(inputValue ?? ""));
  }
  assert.ok([...form.keys()].length > 0, "The switcher must render a working server action.");
  form.set("profile", value);
  return fetch(`${baseUrl}${path}`, {
    method: "POST", headers: { Origin: baseUrl }, body: form, redirect: "manual",
  });
}

test("every profile button persists its selection and returns to Home from Courses", async () => {
  for (const [value, course, excluded] of [
    ["parent:family-parker", /Pre-Algebra/, /American Literature/],
    ["student:student-ava", /English II/, /Pre-Algebra/],
    ["student:student-noah", /Pre-Algebra/, /English II/],
    ["parent:family-rivera", /American Literature/, /English II/],
    ["student:student-elena", /American Literature/, /English II/],
  ]) {
    const response = await submitProfile(value, "/courses");
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/");
    const cookie = response.headers.getSetCookie().find((value) => value.startsWith("homeschool-demo-profile="));
    assert.ok(cookie);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=lax/i);
    const headers = { cookie: cookie.split(";")[0] };
    const home = await fetch(`${baseUrl}/`, { headers });
    assert.equal(home.status, 200);
    assert.match(await home.text(), value.startsWith("student:") ? /Your learning starts here/ : /Meet your learners/);
    const selected = await fetch(`${baseUrl}/courses`, { headers });
    const html = await selected.text();
    assert.match(html, course);
    assert.doesNotMatch(html, excluded);
  }
});

test("malformed and nonexistent profile submissions show explicit errors without saving cookies", async () => {
  for (const [value, message] of [
    ["unexpected-value", /Choose one of the available demo profiles/],
    ["student:missing", /That profile is no longer available/],
  ]) {
    const response = await submitProfile(value);
    assert.equal(response.status, 200);
    assert.match(await response.text(), message);
    assert.equal(response.headers.getSetCookie().length, 0);
  }
});

test("an invalid stored profile recovers to the default workspace and unknown routes return 404", async () => {
  const invalid = await page("/", "student:missing");
  assert.equal(invalid.response.status, 200);
  assert.match(invalid.html, /Parent workspace/);
  assert.match(serverOutput, /Unknown demo profile cookie/);
  const missing = await page("/not-a-real-page");
  assert.equal(missing.response.status, 404);
  assert.match(missing.html, /Back to overview/);
});
