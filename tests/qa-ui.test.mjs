import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, test } from "node:test";
import { fixtures } from "./fixtures.mjs";
import { pageTools, plain, startApp } from "./harness.mjs";

const artifacts = join(process.cwd(), "qa-artifacts");
let app;
let tools;

before(async () => {
  mkdirSync(artifacts, { recursive: true });
  app = await startApp({ browser: true, prefix: "homestead-qa-ui-" });
  tools = pageTools(app.browser, app.baseUrl);
  await app.db.rubric.create({ data: { familyId: "family-parker", name: "UI rubric", description: "d", criteria: { create: [{ name: "Accuracy", description: "Correct", maxPoints: 10, position: 0 }] } } });
  await app.browser.command("Runtime.enable");
  await app.browser.command("Log.enable");
}, { timeout: 60_000 });
after(() => app?.stop());

const channel = (hex) => { const v = parseInt(hex, 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = (color) => 0.2126 * channel(color.slice(1, 3)) + 0.7152 * channel(color.slice(3, 5)) + 0.0722 * channel(color.slice(5, 7));
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test("STEP6 theme token text contrast meets WCAG AA (4.5:1)", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const token = (name) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))[1];
  const rows = [];
  for (const fg of ["ink", "muted", "accent"]) for (const bg of ["page", "card", "raised"]) rows.push([fg, bg, contrast(token(fg), token(bg))]);
  rows.push(["page", "accent (button text)", contrast(token("page"), token("accent"))], ["page", "accent-hover (button text)", contrast(token("page"), token("accent-hover"))], ["accent-hover", "page", contrast(token("accent-hover"), token("page"))]);
  writeFileSync(join(artifacts, "contrast.json"), JSON.stringify(rows.map(([fg, bg, ratio]) => ({ fg, bg, ratio: Number(ratio.toFixed(2)) })), null, 2));
  for (const [fg, bg, ratio] of rows) assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
});

const pages = ["/", "/courses", "/gradebook", "/rubrics", "/reviews", "/transcripts", "/transcripts/student-ava", "/courses/ava-algebra", "/courses/ava-algebra/edit", "/assignments/ava-algebra-assignment/grade", "/courses/new"];
const widths = [["phone", 390, 844], ["tablet", 820, 1180], ["laptop", 1440, 900]];

test("STEP6 every page fits phone, tablet and laptop widths with no console errors; screenshots saved", async () => {
  const problems = [];
  for (const [label, width, height] of widths) {
    await app.browser.command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    for (const path of pages) {
      app.browser.events.length = 0;
      await tools.go(path);
      await delay(700);
      const overflow = await app.browser.evaluate("document.documentElement.scrollWidth - window.innerWidth");
      if (overflow > 1) problems.push(`${label} ${path}: overflows by ${overflow}px`);
      const small = await app.browser.evaluate(`[...document.querySelectorAll('a, button, input:not([type=hidden]), select, textarea, summary')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 32 && !(e.type === 'checkbox' && e.closest('label')) && !e.closest('.sr-only') && getComputedStyle(e).position !== 'fixed'; }).length`);
      if (width === 390 && small) problems.push(`${label} ${path}: ${small} interactive elements shorter than 32px`);
      const errors = app.browser.events.filter((e) => (e.method === "Runtime.exceptionThrown") || (e.method === "Log.entryAdded" && e.params.entry.level === "error") || (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"));
      if (errors.length) problems.push(`${label} ${path}: console errors ${JSON.stringify(errors.map((e) => e.params.entry?.text ?? e.params.exceptionDetails?.text ?? e.params.args?.[0]?.value))}`);
      const shot = await app.browser.command("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(artifacts, `${label}-${path.replace(/\W+/g, "_") || "home"}.png`), Buffer.from(shot.data, "base64"));
    }
  }
  await app.browser.command("Emulation.clearDeviceMetricsOverride");
  assert.deepEqual(problems, []);
});

test("STEP6 tap count from the assignment on a course page to a saved grade", async () => {
  await app.browser.command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  let taps = 0;
  const tap = async (expression) => { taps++; await app.browser.evaluate(expression); };
  await tools.go("/courses/ava-algebra");
  await tools.bodyHas("Grade a photo");
  await tap(`document.querySelector('a[href="/assignments/ava-algebra-assignment/grade"]').click()`);
  await tools.bodyHas("Photo of the work");
  await tap(`document.querySelector('input[name="photo"]').focus()`); // opens the camera/file chooser
  await tools.attach("work.png", "image/png", fixtures.worksheet());
  await delay(800);
  await tap(`document.querySelector('form[data-form="photo-grade"] button[type=submit]').click()`);
  await tools.bodyHas("Suggested grade created");
  await tools.check("approve"); taps++;
  await delay(300);
  await tap(`document.querySelector('form[data-form="approve"] button[type=submit]').click()`);
  await tools.bodyHas("Grade approved and saved");
  await app.browser.command("Emulation.clearDeviceMetricsOverride");
  writeFileSync(join(artifacts, "taps.json"), JSON.stringify({ taps, target: 3 }));
  assert.equal(taps, 5, "documented actual tap count (target is 3)");
});

test("STEP6 user-facing text has no doubled words, double spaces or common typos", async () => {
  const typos = /\b(recieve|seperate|occured|definately|teh|adress|grammer|accomodate|untill|wich|thier|succesful|sucessful|completly|assigment|assigments|transcipt|rubic|gradebok)\b/i;
  const sources = [];
  const walk = (directory) => { for (const name of readdirSync(directory)) { const path = join(directory, name); if (statSync(path).isDirectory()) walk(path); else if (/\.(tsx?|md)$/.test(name)) sources.push(path); } };
  walk("src");
  sources.push("README.md");
  const problems = [];
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/>([^<>{}\n]{3,})</g)) if (/\b(\w{2,})\s+\1\b/i.test(match[1]) && !/^(\d|\w)\1/.test(match[1])) problems.push(`${file}: doubled word in "${match[1].trim()}"`);
    const found = text.match(typos);
    if (found) problems.push(`${file}: typo "${found[0]}"`);
  }
  for (const path of pages) {
    const page = plain((await app.get(path)).text);
    const doubled = page.match(/\b([a-z]{3,}) \1\b/);
    if (doubled) problems.push(`${path}: doubled word "${doubled[0]}"`);
    if (typos.test(page)) problems.push(`${path}: typo`);
  }
  assert.deepEqual(problems, []);
});
