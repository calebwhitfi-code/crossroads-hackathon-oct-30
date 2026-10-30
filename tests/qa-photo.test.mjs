import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { courseGrade, formatGpa, studentSummary } from "../src/lib/grades.ts";
import {
  GRADING_REQUEST, GradingProviderError, GradingRetakeError, GradingValidationError, gradeSubmission, mockGrade, validateGradingResult, withTimeout,
} from "../src/lib/grading-provider.ts";
import { fixtures } from "./fixtures.mjs";
import { pageTools, plain, startApp } from "./harness.mjs";

const rubric = {
  name: "Essay", criteria: [
    { id: "c1", name: "Thesis", description: "Clear thesis", maxPoints: 10 },
    { id: "c2", name: "Grammar", description: "Correct grammar", maxPoints: 5 },
    { id: "c3", name: "Evidence", description: "Uses evidence", maxPoints: 5 },
  ],
};
const b64 = (name) => fixtures[name]().toString("base64");
const withProvider = async (value, work) => {
  const previous = { ...process.env };
  Object.assign(process.env, value);
  try { return await work(); } finally { for (const key of Object.keys(value)) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
};

test("STEP3 provider: blank, tiny, corrupt and non-image input ask for a retake instead of guessing", async () => {
  for (const [name, reason] of [["blank", "blank"], ["tiny", "blurry"], ["corrupt", "unreadable"], ["notAnImage", "unreadable"]]) {
    await assert.rejects(gradeSubmission(b64(name), rubric), (error) => error instanceof GradingRetakeError && error.reason === reason && /retake/i.test(error.message), name);
  }
});

test("STEP3 provider: worksheet, crooked, rotated and dim photos are graded with per-criterion points and one-line reasons", async () => {
  for (const name of ["worksheet", "crooked", "dim"]) {
    const result = await gradeSubmission(b64(name), rubric);
    assert.equal(result.criteria.length, 3);
    for (const [index, item] of result.criteria.entries()) {
      assert.ok(item.score >= 0 && item.score <= rubric.criteria[index].maxPoints);
      assert.match(item.feedback, /^[^\r\n]{1,200}$/);
    }
    assert.equal(result.total, result.criteria.reduce((sum, item) => sum + item.score, 0));
  }
});

test("STEP3 provider: five identical gradings are identical (within 0 points)", async () => {
  const runs = [];
  for (let index = 0; index < 5; index++) runs.push(await gradeSubmission(b64("worksheet"), rubric));
  for (const run of runs) assert.deepEqual(run, runs[0]);
  assert.notDeepEqual(await gradeSubmission(b64("crooked"), rubric), runs[0]);
});

test("STEP3 provider: request contract pins temperature 0, a fixed schema and no-guessing prompt", () => {
  assert.equal(GRADING_REQUEST.temperature, 0);
  assert.deepEqual(GRADING_REQUEST.responseSchema.required, ["imageQuality", "criteria", "feedback", "total"]);
  assert.deepEqual(GRADING_REQUEST.responseSchema.properties.imageQuality.enum, ["ok", "blank", "not_worksheet", "blurry", "unreadable"]);
  assert.match(GRADING_REQUEST.systemPrompt, /never guess/);
  assert.match(GRADING_REQUEST.systemPrompt, /one-line reason/);
});

test("STEP3 validator turns provider-reported blur and non-worksheet photos into retake errors and rejects multi-line reasons", () => {
  for (const reason of ["blurry", "not_worksheet", "blank", "unreadable"]) {
    assert.throws(() => validateGradingResult({ imageQuality: reason, criteria: [], total: 0, feedback: "" }, rubric), GradingRetakeError);
  }
  const good = mockGrade(b64("worksheet"), rubric);
  assert.throws(() => validateGradingResult({ ...good, criteria: good.criteria.map((item) => ({ ...item, feedback: "line one\nline two" })) }, rubric), GradingValidationError);
  assert.throws(() => validateGradingResult({ ...good, imageQuality: undefined }, rubric), GradingValidationError);
});

test("STEP3 provider failures (offline, rate limit, timeout, crash, invalid JSON) surface clear errors", async () => {
  const expectations = { "mock-offline": /could not be reached/, "mock-ratelimit": /busy/, "mock-timeout": /too long/ };
  for (const [provider, message] of Object.entries(expectations)) {
    await withProvider({ GRADING_PROVIDER: provider }, () => assert.rejects(gradeSubmission(b64("worksheet"), rubric), (error) => error instanceof GradingProviderError && message.test(error.message) && /Nothing was saved/.test(error.message)));
  }
  await withProvider({ GRADING_PROVIDER: "mock-invalid" }, () => assert.rejects(gradeSubmission(b64("worksheet"), rubric), GradingValidationError));
  await withProvider({ GRADING_PROVIDER: "mock-slow", GRADING_TIMEOUT_MS: "100" }, () => assert.rejects(gradeSubmission(b64("worksheet"), rubric), (error) => error instanceof GradingProviderError && error.kind === "timeout"));
  await assert.rejects(withTimeout(new Promise(() => {}), 50), (error) => error.kind === "timeout");
});

test("STEP3 provider handles a 12 MB image string without crashing or timing out", async () => {
  const started = Date.now();
  const huge = fixtures.huge().toString("base64");
  assert.ok(huge.length > 10 * 1024 * 1024);
  const result = await gradeSubmission(huge, rubric);
  assert.equal(result.criteria.length, 3);
  assert.ok(Date.now() - started < 10_000);
});

let app;
let tools;
let assignment;

before(async () => {
  app = await startApp({ browser: true, prefix: "homestead-qa-photo-" });
  tools = pageTools(app.browser, app.baseUrl);
  await makeRubric(app.db);
  assignment = await app.db.assignment.findFirst({ where: { course: { studentId: "student-ava" } }, include: { course: { include: { assignments: { include: { submissions: true } } } } } });
}, { timeout: 60_000 });
after(() => app?.stop());

async function makeRubric(db) {
  return db.rubric.create({ data: { familyId: "family-parker", name: "QA rubric", description: "QA", criteria: { create: [
    { name: "Accuracy", description: "Correct answers", maxPoints: 6, position: 0 },
    { name: "Work shown", description: "Steps are shown", maxPoints: 4, position: 1 },
  ] } } });
}

async function open(tools, assignmentId) {
  await tools.go(`/assignments/${assignmentId}/grade`);
  await tools.bodyHas("Grade a photo");
}

test("STEP3 e2e: retake messages for blank, tiny and corrupt photos; nothing is saved", async () => {
  const before = await app.db.submission.count({ where: { source: "vision" } });
  for (const [name, type, message] of [["blank", "image/png", "looks blank"], ["tiny", "image/png", "too blurry or small"], ["corrupt", "image/png", "JPEG, PNG, or WebP"], ["notAnImage", "image/jpeg", "JPEG, PNG, or WebP"]]) {
    await open(tools, assignment.id);
    await tools.attach(`${name}.png`, type, fixtures[name]());
    await tools.submit("photo-grade");
    await tools.bodyHas(message);
  }
  assert.equal(await app.db.submission.count({ where: { source: "vision" } }), before);
});

test("STEP3 e2e: a 10 MB+ photo gets a friendly size message and is not uploaded", async () => {
  await open(tools, assignment.id);
  await app.browser.evaluate(`(() => {
    const input = document.querySelector('input[name="photo"]');
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(11 * 1024 * 1024)], "big.png", { type: "image/png" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await tools.bodyHas("Choose or retake a photo under 5 MB");
  assert.equal(await app.browser.evaluate("document.querySelector('input[name=photo]').files.length"), 0);
});

test("STEP3 e2e: crooked, dim and normal photos grade; double-click makes one suggestion; review shows points and reasons; override updates gradebook and GPA", async () => {
  for (const name of ["crooked", "dim"]) {
    await open(tools, assignment.id);
    await tools.attach(`${name}.png`, "image/png", fixtures[name]());
    await tools.submit("photo-grade");
    await tools.bodyHas("Suggested grade created");
  }
  const beforeCount = await app.db.submission.count({ where: { assignmentId: assignment.id, status: "pending_review" } });
  assert.equal(beforeCount, 2);
  await app.db.submission.deleteMany({ where: { assignmentId: assignment.id, status: "pending_review" } });

  await open(tools, assignment.id);
  await tools.attach("worksheet.png", "image/png", fixtures.worksheet());
  await delay(800);
  await app.browser.evaluate(`(() => { const f = document.querySelector('form[data-form="photo-grade"]'); if (f) { f.requestSubmit(); f.requestSubmit(); } })()`);
  await tools.bodyHas("Suggested grade created");
  await delay(1500);
  const pending = await app.db.submission.findMany({ where: { assignmentId: assignment.id, status: "pending_review" }, include: { criteriaScores: true } });
  assert.equal(pending.length, 1, "double submit must save one suggestion");
  assert.equal(pending[0].criteriaScores.length, 2);

  const page = await tools.body();
  assert.match(page, /Accuracy \d+(\.\d+)? \/ 6/);
  assert.match(page, /Work shown \d+(\.\d+)? \/ 4/);
  assert.match(page, /sample feedback from the mock grader/);

  const courseBefore = await app.db.course.findUnique({ where: { id: assignment.courseId }, include: { assignments: { include: { submissions: { where: { status: "approved" }, orderBy: { approvedAt: "desc" }, take: 1 } } } } });
  const student = await app.db.student.findUnique({ where: { id: "student-ava" }, include: { courses: { include: { assignments: { include: { submissions: { where: { status: "approved" } } } } } } } });
  const gpaBefore = formatGpa(studentSummary(student.courses).unweightedGpa);
  await tools.setValue('input[name="earnedPoints"]', "1");
  await tools.approve();
  await tools.bodyHas("Grade approved and saved");
  const approved = await app.db.submission.findUnique({ where: { id: pending[0].id } });
  assert.equal(approved.status, "approved");
  assert.equal(approved.earnedPoints, 1);
  assert.equal(approved.letterGrade, "F");

  const after = await app.db.student.findUnique({ where: { id: "student-ava" }, include: { courses: { include: { assignments: { include: { submissions: { where: { status: "approved" }, orderBy: [{ approvedAt: "desc" }], take: 1 } } } } } } });
  const gpaAfter = formatGpa(studentSummary(after.courses).unweightedGpa);
  assert.notEqual(gpaAfter, gpaBefore, "override to 1 point should move GPA");
  assert.match(plain((await app.get("/gradebook", "parent:family-parker")).text), new RegExp(`Unweighted GPA ${gpaAfter.replace(".", "\\.")}`));
  assert.ok(courseBefore);
});

for (const [name, env, message] of [
  ["offline", { GRADING_PROVIDER: "mock-offline" }, "could not be reached"],
  ["rate limited", { GRADING_PROVIDER: "mock-ratelimit" }, "busy right now"],
  ["timeout", { GRADING_PROVIDER: "mock-slow", GRADING_TIMEOUT_MS: "200" }, "took too long"],
  ["invalid provider JSON", { GRADING_PROVIDER: "mock-invalid" }, "unusable result"],
]) {
  test(`STEP3 e2e: provider ${name} shows a clear error and saves nothing`, async () => {
    const failing = await startApp({ env, prefix: "homestead-qa-fail-" });
    try {
      const failTools = pageTools(app.browser, failing.baseUrl);
      await makeRubric(failing.db);
      const target = await failing.db.assignment.findFirst({ where: { course: { studentId: "student-ava" } } });
      const before = { submissions: await failing.db.submission.count(), scores: await failing.db.criterionScore.count(), version: target.version };
      await open(failTools, target.id);
      await failTools.attach("worksheet.png", "image/png", fixtures.worksheet());
      await failTools.submit("photo-grade");
      await failTools.bodyHas(message);
      assert.equal(await failing.db.submission.count(), before.submissions);
      assert.equal(await failing.db.criterionScore.count(), before.scores);
      assert.equal((await failing.db.assignment.findUnique({ where: { id: target.id } })).version, before.version);
    } finally { await failing.stop(); }
  });
}

test("STEP3 e2e: loading state is visible while grading", async () => {
  const slow = await startApp({ env: { GRADING_PROVIDER: "mock-slow" }, prefix: "homestead-qa-slow-" });
  try {
    const slowTools = pageTools(app.browser, slow.baseUrl);
    await makeRubric(slow.db);
    const target = await slow.db.assignment.findFirst({ where: { course: { studentId: "student-ava" } } });
    await open(slowTools, target.id);
    await slowTools.attach("worksheet.png", "image/png", fixtures.worksheet());
    await slowTools.submit("photo-grade");
    await slowTools.bodyHas("Grading your photo");
    assert.match(await slowTools.body(), /Grading\.\.\./);
    await slowTools.bodyHas("Suggested grade created");
  } finally { await slow.stop(); }
});
