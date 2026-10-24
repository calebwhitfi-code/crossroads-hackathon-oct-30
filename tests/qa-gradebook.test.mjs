import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { courseGrade, formatPercentage, letterGradeFor, studentSummary } from "../src/lib/grades.ts";
import { mainText, pageTools, plain, seedSpecData, startApp } from "./harness.mjs";

let app;
let tools;
const parent = "parent:family-qa";

before(async () => {
  app = await startApp({ browser: true, prefix: "homestead-qa-gradebook-" });
  await seedSpecData(app.db);
  tools = pageTools(app.browser, app.baseUrl);
  await tools.profile(parent);
}, { timeout: 60_000 });
after(() => app?.stop());

const include = { assignments: { include: { submissions: { where: { status: "approved" }, orderBy: { createdAt: "desc" }, take: 1 } } } };
const specCourses = () => app.db.course.findMany({ where: { studentId: "qa-student" }, include, orderBy: { name: "asc" } });

test("STEP1 spec data: letters, credits and GPA match exactly", async () => {
  const courses = await specCourses();
  const byName = Object.fromEntries(courses.map((course) => [course.name, courseGrade(course)]));
  assert.deepEqual(Object.fromEntries(Object.entries(byName).map(([name, grade]) => [name, grade.letter])),
    { "Algebra I": "A", "English 9": "B", Biology: "C", Bible: "A", PE: "D" });
  const summary = studentSummary(courses);
  assert.equal(summary.earnedCredits, 4);
  assert.equal(summary.unweightedGpa, 2.875);
  assert.equal(summary.weightedGpa, 2.875);
});

test("STEP1 spec data: app uses total-points math, not the category weights (reported for decision)", async () => {
  const courses = await specCourses();
  const percent = Object.fromEntries(courses.map((course) => [course.name, courseGrade(course).percentage]));
  const spec = { "Algebra I": 93.5, "English 9": 85.5, Biology: 77.6, Bible: 100, PE: 61.1 };
  const differing = Object.keys(spec).filter((name) => Math.abs(percent[name] - spec[name]) > 0.05);
  // Documented mismatch: the app has no assignment categories, so percentages differ while letters and GPA agree.
  assert.deepEqual(differing, ["Algebra I", "English 9", "Biology", "PE"]);
  assert.equal(percent["Algebra I"], 93);
});

test("STEP1 same numbers appear on dashboard, gradebook and transcript", async () => {
  for (const path of ["/", "/gradebook", "/transcripts/qa-student"]) {
    const { status, text } = await app.get(path, parent);
    const page = plain(text);
    assert.equal(status, 200, path);
    assert.match(page, /2\.88/, `${path} GPA`);
    assert.doesNotMatch(page, /NaN|undefined|\[object/, `${path} has broken values`);
  }
  const gradebook = plain((await app.get("/gradebook", parent)).text);
  assert.match(gradebook, /Earned credits 4 /);
  assert.match(gradebook, /Algebra I.*A \/ 93\.0%/);
  assert.match(gradebook, /Biology.*C \/ 76\.6%/);
  const transcript = plain((await app.get("/transcripts/qa-student", parent)).text);
  assert.match(transcript, /Credits earned 4 /);
  assert.match(transcript, /Completed courses 5/);
  assert.match(transcript, /PE.*D \/ 61\.0% 0\.5 of 0\.5/);
  assert.match(plain((await app.get("/", parent)).text), /Graded courses 05 /);
});

test("STEP2 grade boundaries and extremes", () => {
  for (const [percent, letter] of [[100, "A"], [90, "A"], [89.9, "B"], [89.99, "B"], [80, "B"], [79.9, "C"], [70, "C"], [69.9, "D"], [60, "D"], [59.9, "F"], [0, "F"]]) {
    assert.equal(letterGradeFor(percent), letter, String(percent));
  }
  assert.throws(() => letterGradeFor(100.1));
  assert.throws(() => letterGradeFor(-0.1));
  assert.throws(() => letterGradeFor(NaN));
  assert.equal(formatPercentage(89.99), "89.9%");
  assert.equal(formatPercentage(0), "0.0%");
  assert.equal(formatPercentage(100), "100.0%");
});

test("STEP2 failed course earns 0 credits but counts in GPA; rule is shown; no grades never shows NaN or 0%", async () => {
  await app.db.course.create({ data: { studentId: "qa-other", name: "Failing Course", subject: "QA", credits: 1, gradeLevel: 9, academicYear: "2026-2027", completed: true,
    assignments: { create: { title: "Only", maxPoints: 100, submissions: { create: { feedback: "", status: "approved", earnedPoints: 59.9, letterGrade: "F", approvedAt: new Date() } } } } } });
  await app.db.course.create({ data: { studentId: "qa-other", name: "Empty Course", subject: "QA", credits: 1, gradeLevel: 9, academicYear: "2026-2027" } });
  const courses = await app.db.course.findMany({ where: { studentId: "qa-other" }, include });
  const summary = studentSummary(courses);
  assert.equal(summary.earnedCredits, 0);
  assert.equal(summary.unweightedGpa, 0);
  const page = plain((await app.get("/gradebook", parent)).text);
  assert.match(page, /earns 0 credits but still counts in GPA/);
  assert.match(page, /Empty Course.*No grades yet/);
  assert.doesNotMatch(page, /NaN|undefined|\[object/);
  const emptyId = courses.find((course) => course.name === "Empty Course").id;
  const course = plain((await app.get(`/courses/${emptyId}`, parent)).text);
  assert.match(course, /No grades yet/);
  assert.doesNotMatch(course, /0\.0%|NaN/);
});

test("STEP2 add, revise and delete a grade updates course %, letter and GPA immediately; deletes ask for confirmation and leave no orphans", async () => {
  const course = await app.db.course.create({ data: { studentId: "qa-other", name: "Live Course", subject: "QA", credits: 1, gradeLevel: 9, academicYear: "2026-2027" } });
  const assignment = await app.db.assignment.create({ data: { courseId: course.id, title: "Live Work", maxPoints: 100 } });
  await tools.go(`/courses/${course.id}`);
  const grade = async (points, lastApproved) => {
    await tools.setValue(`form[data-form="grade-${assignment.id}"] input[name="earnedPoints"]`, String(points));
    await tools.check("approve");
    await tools.submit(`grade-${assignment.id}`);
  };
  await grade(100);
  await tools.bodyHas("A / 100.0%");
  await tools.go(`/courses/${course.id}`);
  await grade(59.9);
  await tools.bodyHas("F / 59.9%");
  assert.equal(await app.db.submission.count({ where: { assignmentId: assignment.id } }), 2);
  const gradebook = plain((await app.get("/gradebook", parent)).text);
  assert.match(gradebook, /Live Course.*F \/ 59\.9%/);

  await tools.go(`/assignments/${assignment.id}/edit`);
  await tools.check("confirm");
  await tools.submit("delete-assignment");
  await tools.bodyHas("No grades yet");
  assert.equal(await app.db.submission.count({ where: { assignmentId: assignment.id } }), 0);

  const second = await app.db.assignment.create({ data: { courseId: course.id, title: "Scored", maxPoints: 100 } });
  const submission = await app.db.submission.create({ data: { assignmentId: second.id, source: "vision", feedback: "x", suggestedGrade: "5", criteriaScores: { create: [] } } });
  const rubric = await app.db.rubric.create({ data: { familyId: "family-qa", name: "R", description: "R", criteria: { create: [{ name: "C", description: "C", maxPoints: 5, position: 0 }] } }, include: { criteria: true } });
  await app.db.criterionScore.create({ data: { submissionId: submission.id, criterionId: rubric.criteria[0].id, earnedPoints: 4, feedback: "ok", name: "C", description: "C", maxPoints: 5 } });
  await tools.go(`/courses/${course.id}/edit`);
  await tools.submit("delete-course", { novalidate: true });
  await tools.bodyHas("Confirm that you want to delete");
  assert.ok(await app.db.course.findUnique({ where: { id: course.id } }), "deleting without confirmation must not delete");
  await tools.check("confirm");
  await tools.submit("delete-course");
  await tools.bodyHas("deleted");
  assert.equal(await app.db.course.findUnique({ where: { id: course.id } }), null);
  assert.equal(await app.db.assignment.count({ where: { courseId: course.id } }), 0);
  assert.equal(await app.db.submission.count({ where: { id: submission.id } }), 0);
  assert.equal(await app.db.criterionScore.count({ where: { submissionId: submission.id } }), 0);
});

test("STEP2 deleting a student cascades with no orphaned courses, grades, submissions or scores (no student-delete UI exists)", async () => {
  const student = await app.db.student.create({ data: { familyId: "family-qa", firstName: "Temp", lastName: "Kid", gradeLevel: 9, graduationYear: 2031 } });
  const course = await app.db.course.create({ data: { studentId: student.id, name: "Temp", subject: "QA", credits: 1, gradeLevel: 9, academicYear: "2026-2027" } });
  const assignment = await app.db.assignment.create({ data: { courseId: course.id, title: "T", maxPoints: 10 } });
  const rubric = await app.db.rubric.create({ data: { familyId: "family-qa", name: "Temp rubric", description: "d", criteria: { create: [{ name: "C", description: "C", maxPoints: 5, position: 0 }] } }, include: { criteria: true } });
  const submission = await app.db.submission.create({ data: { assignmentId: assignment.id, source: "vision", feedback: "f", criteriaScores: { create: [{ criterionId: rubric.criteria[0].id, earnedPoints: 1, feedback: "f", name: "C", description: "C", maxPoints: 5 }] } } });
  await app.db.student.delete({ where: { id: student.id } });
  assert.equal(await app.db.course.count({ where: { id: course.id } }), 0);
  assert.equal(await app.db.assignment.count({ where: { id: assignment.id } }), 0);
  assert.equal(await app.db.submission.count({ where: { id: submission.id } }), 0);
  assert.equal(await app.db.criterionScore.count({ where: { submissionId: submission.id } }), 0);
});

test("STEP2 students never see another student's or another family's grades", async () => {
  const other = await app.db.course.findFirst({ where: { name: "Failing Course" } });
  const own = await app.get("/courses", "student:qa-student");
  assert.match(plain(own.text), /Algebra I/);
  assert.doesNotMatch(plain(own.text), /Failing Course/);
  assert.doesNotMatch(mainText((await app.get(`/courses/${other.id}`, "student:qa-student")).text), /Failing Course/);
  assert.doesNotMatch(mainText((await app.get("/gradebook", "student:qa-student")).text), /Failing Course|Riley/);
  assert.doesNotMatch(mainText((await app.get("/", "student:qa-student")).text), /Riley/);
  assert.doesNotMatch(mainText((await app.get("/transcripts/qa-other", "student:qa-student")).text), /Failing Course|Official homeschool/);
  assert.match(plain((await app.get("/reviews", "student:qa-student")).text), /Only a parent/);
  for (const path of ["/courses/ava-algebra", "/transcripts/student-ava", "/gradebook"]) {
    const page = mainText((await app.get(path, parent)).text);
    assert.doesNotMatch(page, /Ava|Algebra II|Parker/, `cross-family leak on ${path}`);
  }
  assert.doesNotMatch(mainText((await app.get("/courses/ava-algebra", "student:qa-student")).text), /Algebra II/);
});

test("STEP2 a stale parent tab cannot save after switching to a student profile", async () => {
  const course = await app.db.course.findFirst({ where: { name: "Empty Course" }, include: { assignments: true } });
  const assignment = await app.db.assignment.create({ data: { courseId: course.id, title: "Tamper", maxPoints: 100 } });
  await tools.go(`/courses/${course.id}`);
  await tools.setValue(`form[data-form="grade-${assignment.id}"] input[name="earnedPoints"]`, "100");
  await tools.check("approve");
  await tools.profile("student:qa-student");
  await tools.openAll();
  await tools.submit(`grade-${assignment.id}`);
  await tools.bodyHas("Switch to a valid parent profile");
  assert.equal(await app.db.submission.count({ where: { assignmentId: assignment.id } }), 0);
  await tools.profile(parent);
});

test("STEP4 invalid numbers, empty submits and oversize names are rejected with messages and nothing is saved", async () => {
  const course = await app.db.course.findFirst({ where: { name: "Empty Course" } });
  const assignment = await app.db.assignment.findFirst({ where: { courseId: course.id, title: "Tamper" } });
  const bad = [["-5", "no negative sign"], ["101", "cannot exceed possible points"], ["abc", "required"], ["1e2", "no negative sign or letters"], ["90.123", "at most two decimal"], ["", "required"]];
  for (const [value, message] of bad) {
    await tools.go(`/courses/${course.id}`);
    await tools.setValue(`form[data-form="grade-${assignment.id}"] input[name="earnedPoints"]`, value);
    await tools.check("approve");
    await tools.openAll();
    await tools.submit(`grade-${assignment.id}`, { novalidate: true });
    await tools.bodyHas(message);
  }
  assert.equal(await app.db.submission.count({ where: { assignmentId: assignment.id } }), 0);

  const before = await app.db.course.count();
  await tools.go("/courses/new");
  await tools.submit("course", { novalidate: true });
  await tools.bodyHas("Course name is required");
  await tools.setValue('input[name="name"]', "x".repeat(500));
  await tools.setValue('input[name="subject"]', "Math");
  await tools.submit("course", { novalidate: true });
  await tools.bodyHas("120 characters or fewer");
  assert.equal(await app.db.course.count(), before);
});

test("STEP4 emoji and script-tag names render as plain text", async () => {
  await tools.go("/rubrics");
  const scripts = await app.browser.evaluate("document.querySelectorAll('script').length");
  await tools.setValue('input[name="name"]', "<script>alert(1)</script> 📚");
  await tools.setValue('input[name="name0"]', "<b>bold</b> 🧮");
  await tools.setValue('input[name="maxPoints0"]', "5");
  await tools.submit("rubric");
  await tools.bodyHas("<script>alert(1)</script> 📚");
  assert.equal(await app.browser.evaluate("document.querySelectorAll('script').length"), scripts);
  assert.equal(await app.browser.evaluate("document.querySelectorAll('main b').length"), 0);
  assert.ok(plain((await app.get("/rubrics", parent)).text).includes("<script>alert(1)</script> 📚"));

  await tools.go("/courses/new");
  await tools.setValue('input[name="name"]', "📚 Math & <i>Logic</i>");
  await tools.setValue('input[name="subject"]', "Math");
  await tools.submit("course");
  await tools.bodyHas("📚 Math & <i>Logic</i>");
  assert.equal(await app.browser.evaluate("document.querySelectorAll('main h1 i').length"), 0);
});

test("STEP4 double-clicking submit creates one course and one grade; back, refresh and reopen keep data", async () => {
  await tools.go("/courses/new");
  await tools.setValue('input[name="name"]', "Double Click 101");
  await tools.setValue('input[name="subject"]', "QA");
  await tools.setValue('input[name="gradeLevel"]', "9");
  await delay(800);
  await app.browser.evaluate(`(() => { const f = document.querySelector('form[data-form="course"]'); f.requestSubmit(); f.requestSubmit(); })()`);
  await tools.bodyHas("Course saved");
  await delay(1500);
  assert.equal(await app.db.course.count({ where: { name: "Double Click 101" } }), 1);

  const course = await app.db.course.findFirst({ where: { name: "Double Click 101" } });
  const assignment = await app.db.assignment.create({ data: { courseId: course.id, title: "Twice", maxPoints: 100 } });
  await tools.go(`/courses/${course.id}`);
  await tools.setValue(`form[data-form="grade-${assignment.id}"] input[name="earnedPoints"]`, "88");
  await tools.check("approve");
  await tools.openAll();
  await delay(800);
  await app.browser.evaluate(`(() => { const f = document.querySelector('form[data-form="grade-${assignment.id}"]'); f.requestSubmit(); f.requestSubmit(); })()`);
  await tools.bodyHas("B / 88.0%");
  await delay(1500);
  assert.equal(await app.db.submission.count({ where: { assignmentId: assignment.id } }), 1);

  await app.browser.evaluate("history.back()");
  await delay(800);
  await app.browser.navigate(`${app.baseUrl}/courses/${course.id}`);
  await app.browser.command("Page.reload");
  await tools.bodyHas("B / 88.0%");
  await tools.profile(parent);
  const fresh = await app.get(`/courses/${course.id}`, parent);
  assert.match(plain(fresh.text), /B \/ 88\.0%/);
});

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
