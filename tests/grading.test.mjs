import assert from "node:assert/strict";
import { test } from "node:test";
import { fixtures } from "./fixtures.mjs";
import { gradeSubmission, mockGrade, validateGradingResult } from "../src/lib/grading-provider.ts";
import { ApprovalError, checkApproval, scaleToAssignment } from "../src/lib/approval.ts";
import { GradingImageError, MAX_IMAGE_BYTES, gradingImageType } from "../src/lib/grading-image.ts";

process.env.GRADER = "mock";

const rubric = {
  name: "Essay",
  criteria: [
    { id: "c1", name: "Thesis", description: "Clear thesis", maxPoints: 10 },
    { id: "c2", name: "Grammar", description: "Correct grammar", maxPoints: 5 },
  ],
};
const good = () => ({
  imageQuality: "ok",
  criteria: [{ criterionId: "c1", score: 8, feedback: "ok" }, { criterionId: "c2", score: 4.5, feedback: "ok" }],
  feedback: "Nice", total: 12.5,
});

test("validator accepts a correct result", () => {
  assert.deepEqual(validateGradingResult(good(), rubric).total, 12.5);
});

test("validator rejects malformed, out-of-range, duplicate, unknown and mis-summed results", () => {
  const mutate = (change) => { const value = good(); change(value); return value; };
  const bad = [
    null, [], "x",
    mutate((v) => { v.criteria[0].score = 11; }),
    mutate((v) => { v.criteria[0].score = -1; }),
    mutate((v) => { v.criteria[0].score = "8"; }),
    mutate((v) => { v.criteria[0].score = NaN; }),
    mutate((v) => { v.criteria[1].criterionId = "c1"; }),
    mutate((v) => { v.criteria[1].criterionId = "zzz"; }),
    mutate((v) => { v.criteria.pop(); }),
    mutate((v) => { v.total = 13; }),
    mutate((v) => { delete v.feedback; }),
    mutate((v) => { v.criteria[0].feedback = 5; }),
  ];
  for (const value of bad) assert.throws(() => validateGradingResult(value, rubric), /Invalid grading result/);
});

test("mock provider is deterministic, bounded and passes validation", async () => {
  const image = Buffer.from(fixtures.worksheet()).toString("base64");
  const first = await gradeSubmission(image, rubric);
  const second = await gradeSubmission(image, rubric);
  assert.deepEqual(first, second);
  for (const [index, score] of first.criteria.entries()) {
    assert.ok(score.score >= 0 && score.score <= rubric.criteria[index].maxPoints);
  }
  assert.doesNotThrow(() => validateGradingResult(mockGrade(image + "x", rubric), rubric));
});

test("provider boundary rejects empty images, empty rubrics and unknown providers", async () => {
  await assert.rejects(gradeSubmission("", rubric));
  await assert.rejects(gradeSubmission("abc", { name: "x", criteria: [] }));
  process.env.GRADING_PROVIDER = "other";
  try { await assert.rejects(gradeSubmission("abc", rubric), /not available/); } finally { delete process.env.GRADING_PROVIDER; }
});

test("upload validator accepts supported images and explains type, size, and HEIC failures", () => {
  assert.equal(gradingImageType(fixtures.worksheet()), "image/png");
  assert.throws(
    () => gradingImageType(Buffer.alloc(MAX_IMAGE_BYTES + 1)),
    (error) => error instanceof GradingImageError && error.message === "The photo must be 5 MB or smaller.",
  );
  assert.throws(
    () => gradingImageType(Buffer.from("%PDF-1.4 not an image")),
    (error) => error instanceof GradingImageError && /JPEG, PNG, GIF, or WebP/.test(error.message),
  );
  const heic = Buffer.alloc(64);
  heic.write("ftyp", 4, "ascii");
  heic.write("heic", 8, "ascii");
  assert.throws(
    () => gradingImageType(heic),
    (error) => error instanceof GradingImageError && /HEIC\/HEIF photos are not supported/.test(error.message) && /JPEG or PNG/.test(error.message),
  );
});

test("approval rules: only parents, pending, open courses and points within range", () => {
  const ok = { role: "parent", status: "pending_review", earnedPoints: 9, maxPoints: 10, courseCompleted: false };
  assert.doesNotThrow(() => checkApproval(ok));
  for (const change of [
    { role: "student" }, { status: "approved" }, { courseCompleted: true },
    { earnedPoints: 11 }, { earnedPoints: -1 }, { earnedPoints: NaN },
  ]) assert.throws(() => checkApproval({ ...ok, ...change }), ApprovalError);
});

test("suggested totals scale to assignment points", () => {
  assert.equal(scaleToAssignment(12.5, 15, 30), 25);
  assert.throws(() => scaleToAssignment(1, 0, 10), ApprovalError);
});
