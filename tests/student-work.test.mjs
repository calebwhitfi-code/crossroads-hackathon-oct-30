import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { pageTools, plain, startApp } from "./harness.mjs";

let app;
let course;

before(async () => {
  app = await startApp({ browser: true, prefix: "homestead-student-work-" });
  course = await app.db.course.create({
    data: {
      studentId: "student-ava", name: "Student Work Science", subject: "Science",
      credits: 1, gradeLevel: 10, academicYear: "2026-2027",
      assignments: { create: [
        {
          title: "Approved lab", description: "Explain your observations.", maxPoints: 20,
          dueAt: new Date("2026-11-02T00:00:00Z"),
          submissions: { create: [
            { feedback: "Outdated feedback", status: "approved", earnedPoints: 10, letterGrade: "F", approvedAt: new Date("2026-10-01") },
            { feedback: "Clear explanation. Check your units.", status: "approved", earnedPoints: 18, letterGrade: "A", approvedAt: new Date("2026-10-02") },
            { feedback: "PRIVATE pending lab feedback", suggestedGrade: "B", status: "pending_review" },
          ] },
        },
        {
          title: "Pending lab", maxPoints: 10,
          submissions: { create: { feedback: "PRIVATE pending-only feedback", suggestedGrade: "C" } },
        },
        {
          title: "Zero score", maxPoints: 10,
          submissions: { create: { feedback: "", status: "approved", earnedPoints: 0, letterGrade: "F", approvedAt: new Date() } },
        },
      ] },
    },
  });
  for (const [studentId, name] of [["student-noah", "Sibling private course"], ["student-elena", "Other family private course"]]) {
    await app.db.course.create({ data: {
      studentId, name, subject: "Science", credits: 1, gradeLevel: 9, academicYear: "2026-2027",
      assignments: { create: { title: `${name} assignment`, maxPoints: 100 } },
    } });
  }
}, { timeout: 60_000 });

after(() => app?.stop());

test("student work shows latest approved scores and feedback, never pending or superseded feedback", async () => {
  const { status, text } = await app.get("/work", "student:student-ava");
  assert.equal(status, 200);
  const page = plain(text);
  assert.match(page, /Student Work Science/);
  assert.match(page, /Approved lab.*Due Nov 2, 2026.*Explain your observations.*Parent-approved score: A \/ 18 points.*Clear explanation\. Check your units\./);
  assert.match(page, /Pending lab.*No approved score yet/);
  assert.match(page, /Zero score.*Parent-approved score: F \/ 0 points.*No feedback provided yet/);
  assert.doesNotMatch(text, /PRIVATE pending|Outdated feedback|Sibling private course|Other family private course/);
  assert.doesNotMatch(page, /Add assignment|Enter manual grade|Approve grade/);
  assert.match(text, new RegExp(`href="/courses/${course.id}"`));
  const tools = pageTools(app.browser, app.baseUrl);
  await tools.profile("student:student-ava");
  await tools.go("/work");
  await tools.bodyHas("Clear explanation. Check your units.");
  assert.equal(await app.browser.evaluate(`document.querySelectorAll('main form, main input, main textarea, main button, main a[href$="/edit"], main a[href$="/grade"]').length`), 0);
  assert.match(await app.browser.evaluate(`document.querySelector('nav[aria-label="Main navigation"] a[aria-current="page"]').textContent`), /Student work/);
  const home = await app.get("/", "student:student-ava");
  assert.match(plain(home.text), /Open student work/);
  assert.match(home.text, /href="\/work"/);
});

test("parent work view stays within the selected family and remains read-only", async () => {
  const { text } = await app.get("/work", "parent:family-parker");
  const page = plain(text);
  assert.match(page, /Student Work Science/);
  assert.match(page, /Sibling private course/);
  assert.doesNotMatch(text, /Other family private course|PRIVATE pending/);
  assert.doesNotMatch(page, /Add assignment|Enter manual grade/);
  const tools = pageTools(app.browser, app.baseUrl);
  await tools.profile("parent:family-parker");
  await tools.go("/work");
  await tools.bodyHas("Sibling private course");
  assert.equal(await app.browser.evaluate(`document.querySelectorAll('main form, main input, main textarea, main button, main a[href$="/edit"]').length`), 0);
  const sibling = await app.get("/work", "student:student-noah");
  assert.match(plain(sibling.text), /Sibling private course/);
  assert.doesNotMatch(sibling.text, /Student Work Science|Clear explanation/);
});

test("student work handles empty courses, students without courses, and an empty family", async () => {
  const family = await app.db.family.create({ data: { name: "Empty work family" } });
  assert.match(plain((await app.get("/work", `parent:${family.id}`)).text), /No students in this family yet/);
  const student = await app.db.student.create({ data: {
    familyId: family.id, firstName: "Casey", lastName: "Demo", gradeLevel: 9, graduationYear: 2030,
  } });
  const profile = `student:${student.id}`;
  assert.match(plain((await app.get("/work", profile)).text), /No courses yet/);
  await app.db.course.create({ data: {
    studentId: student.id, name: "Empty work course", subject: "Math", credits: 1, gradeLevel: 9, academicYear: "2026-2027",
  } });
  assert.match(plain((await app.get("/work", profile)).text), /Empty work course.*No assignments yet/);
});

test("student work stays readable on phone, tablet, and desktop with long content and keyboard navigation", async () => {
  const tools = pageTools(app.browser, app.baseUrl);
  const longWord = "LongCourseName".repeat(12);
  await app.db.course.update({ where: { id: course.id }, data: { name: longWord } });
  await app.db.assignment.create({ data: {
    courseId: course.id, title: "LongAssignmentTitle".repeat(12), description: "Instructions".repeat(40),
    maxPoints: 100, submissions: { create: {
      status: "approved", earnedPoints: 90, letterGrade: "A", approvedAt: new Date(), feedback: "Feedback".repeat(60),
    } },
  } });
  await tools.profile("student:student-ava");
  await app.browser.command("Runtime.enable");
  await app.browser.command("Log.enable");
  try {
    for (const width of [390, 820, 1440]) {
      await app.browser.command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      app.browser.events.length = 0;
      await tools.go("/work");
      await tools.bodyHas(longWord);
      assert.ok(await app.browser.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), `Student work overflows at ${width}px`);
      assert.equal(app.browser.events.filter((event) =>
        event.method === "Runtime.exceptionThrown"
        || (event.method === "Log.entryAdded" && event.params.entry.level === "error")
        || (event.method === "Runtime.consoleAPICalled" && event.params.type === "error")
      ).length, 0, `Student work has console errors at ${width}px`);
    }
    await app.browser.evaluate("document.activeElement?.blur()");
    await app.browser.command("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await app.browser.command("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.equal(await app.browser.evaluate("document.activeElement.matches('a, button') && getComputedStyle(document.activeElement).outlineStyle !== 'none'"), true);
  } finally {
    await app.browser.command("Emulation.clearDeviceMetricsOverride");
  }
});
