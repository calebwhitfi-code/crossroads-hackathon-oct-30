import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPrismaClient } from "../prisma/client.mjs";
import { startBrowser, waitFor } from "./browser.mjs";

const run = (script, args = []) => execFileSync(process.execPath, [script, ...args], { env: process.env, encoding: "utf8", stdio: "pipe" });

// Temp database, a production server on a random port, and an optional headless browser.
export async function startApp({ env = {}, browser = false, prefix = "homestead-qa-" } = {}) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
  run("prisma/seed.mjs");
  const db = createPrismaClient();
  let output = "";
  let baseUrl;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "0"], {
    env: { ...process.env, ...env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => {
    output += chunk;
    const match = output.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
    if (match) baseUrl = `http://127.0.0.1:${match[1]}`;
  });
  server.stderr.on("data", (chunk) => { output += chunk; });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !(baseUrl && (await fetch(baseUrl).catch(() => null))?.ok)) await delay(100);
  if (!baseUrl) throw new Error(`Test server did not start:\n${output}`);
  const chrome = browser ? await startBrowser() : null;

  async function stop() {
    await chrome?.close();
    if (server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGTERM");
      await exited;
    }
    await db.$disconnect();
    for (const name of readdirSync(directory)) rmSync(join(directory, name));
    rmdirSync(directory);
  }
  const get = async (path, profile) => {
    const response = await fetch(`${baseUrl}${path}`, { headers: profile ? { cookie: `homeschool-demo-profile=${encodeURIComponent(profile)}` } : {} });
    return { status: response.status, text: (await response.text()).replaceAll("<!-- -->", "") };
  };
  return { db, baseUrl, browser: chrome, stop, get, output: () => output };
}

// Page helpers for forms that use React server actions.
export function pageTools(browser, baseUrl) {
  const setValue = async (selector, text) => {
    await waitFor(() => browser.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`));
    return browser.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  };
  const submit = async (form, { novalidate = false } = {}) => {
    await delay(800);
    if (form === "photo-grade" && !novalidate) return; // choosing a photo already submits the form
    await browser.evaluate(`(() => { const f = document.querySelector('form[data-form="${form}"]'); f.noValidate = ${novalidate}; f.requestSubmit(); })()`);
  };
  const openAll = () => browser.evaluate("document.querySelectorAll('details').forEach((d) => { d.open = true; })");
  const body = () => browser.evaluate("document.body.innerText");
  const bodyHas = (text) => waitFor(async () => (await body()).includes(text));
  const check = async (name) => {
    await waitFor(() => browser.evaluate(`!!document.querySelector('input[name="${name}"]')`));
    return browser.evaluate(`(() => { const b = document.querySelector('input[name="${name}"]'); if (!b.checked) b.click(); })()`);
  };
  const approve = async () => {
    await waitFor(() => browser.evaluate(`!!document.querySelector('form[data-form="approve"] button[name="approve"]')`));
    await delay(800);
    return browser.evaluate(`document.querySelector('form[data-form="approve"] button[name="approve"]').click()`);
  };
  const attach = async (name, type, buffer) => { await delay(800); return browser.evaluate(`(async () => {
    const bytes = Uint8Array.from(atob(${JSON.stringify(buffer.toString("base64"))}), (c) => c.charCodeAt(0));
    const input = document.querySelector('input[name="photo"]');
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  })()`); };
  const profile = (value) => browser.command("Network.setCookie", { name: "homeschool-demo-profile", value: encodeURIComponent(value), url: baseUrl });
  return { setValue, submit, approve, openAll, body, bodyHas, check, attach, profile, go: (path) => browser.navigate(`${baseUrl}${path}`) };
}

export const mainText = (html) => plain(html.match(/<main[\s\S]*<\/main>/)?.[0] ?? html);
export const plain = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");

// Fixed QA data: the user's spec courses, each assignment worth 100 points and parent-approved.
export async function seedSpecData(db) {
  await db.family.create({ data: { id: "family-qa", name: "QA Family" } });
  await db.student.create({ data: { id: "qa-student", familyId: "family-qa", firstName: "Quinn", lastName: "Tester", gradeLevel: 9, graduationYear: 2030 } });
  await db.student.create({ data: { id: "qa-other", familyId: "family-qa", firstName: "Riley", lastName: "Sibling", gradeLevel: 9, graduationYear: 2030 } });
  const spec = [
    ["Algebra I", 1, [["Test 1", 90], ["Test 2", 96], ["Quiz 1", 88], ["Homework 1", 98]]],
    ["English 9", 1, [["Test 1", 85], ["Quiz 1", 80], ["Homework 1", 90]]],
    ["Biology", 1, [["Test 1", 78], ["Quiz 1", 70], ["Homework 1", 82]]],
    ["Bible", 0.5, [["Test 1", 100], ["Quiz 1", 100], ["Homework 1", 100]]],
    ["PE", 0.5, [["Test 1", 61], ["Quiz 1", 60], ["Homework 1", 62]]],
  ];
  for (const [name, credits, grades] of spec) {
    await db.course.create({
      data: {
        studentId: "qa-student", name, subject: "QA", credits, gradeLevel: 9, academicYear: "2026-2027", completed: true,
        assignments: { create: grades.map(([title, earned]) => ({
          title, maxPoints: 100, category: title.startsWith("Test") ? "test" : title.startsWith("Quiz") ? "quiz" : "homework",
          submissions: { create: { feedback: "", status: "approved", source: "manual", earnedPoints: earned, letterGrade: earned >= 90 ? "A" : earned >= 80 ? "B" : earned >= 70 ? "C" : earned >= 60 ? "D" : "F", approvedAt: new Date() } },
        })) },
      },
    });
  }
}
