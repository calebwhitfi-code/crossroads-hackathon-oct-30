import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { pageTools, plain, startApp } from "./harness.mjs";
import { fixtures } from "./fixtures.mjs";

let app;
let tools;
let course;
let student;

before(async () => {
  app = await startApp({ browser: true, prefix: "homestead-guide-" });
  tools = pageTools(app.browser, app.baseUrl);
  student = await app.db.student.create({ data: {
    familyId: "family-parker", firstName: "Morgan", lastName: "Demo", gradeLevel: 10, graduationYear: 2029,
  } });
  course = await app.db.course.create({ data: {
    studentId: student.id, name: "Guide test history", subject: "History", curriculum: "Synthetic curriculum",
    academicYear: "2026-2027", gradeLevel: 10, credits: 1,
    assignments: { create: { title: "History review", maxPoints: 100, submissions: { create: {
      status: "approved", feedback: "Clear answers.", earnedPoints: 91, letterGrade: "A", approvedAt: new Date(),
    } } } },
  }, include: { assignments: true } });
}, { timeout: 60_000 });
after(() => app?.stop());

test("guide review requires parent approval, then applies rubric and scale consistently without approving grades", async () => {
  const rubricCount = await app.db.rubric.count();
  const submissionCount = await app.db.submission.count();
  await tools.go(`/courses/${course.id}/grading-guide`);
  await tools.check("applyRubric");
  await tools.check("applyScale");
  await tools.setValue('[name="rubricName"]', "Reviewed history rubric");
  await tools.setValue('[name="guideName0"]', "Accuracy");
  await tools.setValue('[name="guideDescription0"]', "Check facts against the reading.");
  await tools.setValue('[name="guideMaxPoints0"]', "20");
  for (const [field, points] of [["gradeAMin", "93"], ["gradeBMin", "85"], ["gradeCMin", "75"], ["gradeDMin", "65"]]) {
    await tools.setValue(`[name="${field}"]`, points);
  }
  await tools.submit("grading-guide", { novalidate: true });
  await tools.bodyHas("confirm parent approval");
  assert.equal(await app.db.rubric.count(), rubricCount);
  assert.equal((await app.db.course.findUnique({ where: { id: course.id } })).gradeAMin, 90);
  await tools.check("confirm");
  await tools.submit("grading-guide");
  await tools.bodyHas("Grading guide approved and applied");
  const saved = await app.db.course.findUnique({ where: { id: course.id }, include: { gradingRubric: true } });
  assert.equal(saved.gradeAMin, 93);
  assert.equal(saved.gradingRubric.name, "Reviewed history rubric");
  assert.equal(saved.gradingRubric.familyId, "family-parker");
  assert.equal(await app.db.submission.count(), submissionCount);
  assert.match(await tools.body(), /B \/ 91 points/);
  const studentProfile = `student:${student.id}`;
  assert.match(plain((await app.get("/work", studentProfile)).text), /Parent-approved score: B \/ 91 points/);
  assert.match(plain((await app.get("/gradebook", studentProfile)).text), /Unweighted GPA 3\.00/);
  await tools.go(`/assignments/${course.assignments[0].id}/grade`);
  assert.equal(await app.browser.evaluate(`document.querySelector('[name="rubricId"]').value`), saved.gradingRubricId);
  await app.db.course.update({ where: { id: course.id }, data: { completed: true } });
  const transcript = plain((await app.get(`/transcripts/${student.id}`, studentProfile)).text);
  assert.match(transcript, /B \/ 91\.0%/);
  assert.match(transcript, /A >= 93%/);
});

test("mock guide extraction reports manual entry instead of making up curriculum rules or saving photos", async () => {
  const rubricCount = await app.db.rubric.count();
  const before = await app.db.course.findUnique({ where: { id: "ava-algebra" } });
  await tools.go("/courses/ava-algebra/grading-guide");
  await app.browser.evaluate(`(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([Uint8Array.from(atob(${JSON.stringify(fixtures.worksheet().toString("base64"))}), c => c.charCodeAt(0))], "guide.png", { type: "image/png" }));
    document.querySelector('[name="photos"]').files = transfer.files;
  })()`);
  await tools.submit("read-guide");
  await tools.bodyHas("No rules were extracted");
  assert.equal(await app.db.rubric.count(), rubricCount);
  assert.deepEqual(await app.db.course.findUnique({ where: { id: "ava-algebra" } }), before);
});

test("student, cross-family, stale, completed, and invalid-scale changes are rejected without saving", async () => {
  const target = "ava-algebra";
  const initial = await app.db.course.findUnique({ where: { id: target } });
  await tools.go(`/courses/${target}/grading-guide`);
  await tools.check("applyScale");
  await tools.check("confirm");
  await tools.setValue('[name="gradeBMin"]', "99");
  await tools.submit("grading-guide");
  await tools.bodyHas("A > B > C > D");
  assert.equal((await app.db.course.findUnique({ where: { id: target } })).version, initial.version);
  await tools.setValue('[name="gradeBMin"]', "80");
  await app.db.course.update({ where: { id: target }, data: { version: { increment: 1 } } });
  await tools.check("confirm");
  await tools.submit("grading-guide");
  await tools.bodyHas("changed in another tab");
  await tools.go(`/courses/${target}/grading-guide`);
  await tools.check("applyScale");
  await tools.check("confirm");
  await tools.setValue('form[data-form="grading-guide"] [name="courseId"]', "elena-chemistry");
  await tools.submit("grading-guide");
  await tools.bodyHas("not available in the active family");
  await tools.go(`/courses/${target}/grading-guide`);
  await tools.check("applyScale");
  await tools.check("confirm");
  await tools.profile("student:student-ava");
  await tools.submit("grading-guide");
  await tools.bodyHas("Switch to a valid parent profile");
  const readOnly = plain((await app.get(`/courses/${target}/grading-guide`, "student:student-ava")).text);
  assert.match(readOnly, /Only a parent can change grading rules/);
  const completed = plain((await app.get(`/courses/${course.id}/grading-guide`)).text);
  assert.match(completed, /Reopen this course/);
  assert.equal((await app.db.course.findUnique({ where: { id: target } })).gradeAMin, 90);
});
