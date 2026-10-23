import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTranscript } from "../src/lib/transcript.ts";

const approved = (earned) => ({ id: `s${earned}`, status: "approved", earnedPoints: earned, approvedAt: new Date(1), createdAt: new Date(1) });
const course = (id, over, earned = 95) => ({
  id, name: id, subject: "x", credits: 1, weighted: false, gradeLevel: 10, academicYear: "2026-2027", completed: true,
  assignments: [{ maxPoints: 100, submissions: [approved(earned)] }], ...over,
});

test("only completed, fully graded courses appear, grouped by sorted school year", () => {
  const t = buildTranscript([
    course("b", { academicYear: "2027-2028", gradeLevel: 11 }, 85),
    course("a", {}, 95),
    course("open", { completed: false }),
    course("ungraded", { assignments: [{ maxPoints: 100, submissions: [] }] }),
  ]);
  assert.deepEqual(t.years.map((y) => y.academicYear), ["2026-2027", "2027-2028"]);
  assert.deepEqual(t.years.map((y) => y.rows.map((r) => r.id)), [["a"], ["b"]]);
  assert.equal(t.courseCount, 2);
});

test("GPA and credits reuse gradebook rules", () => {
  const t = buildTranscript([
    course("a", {}, 95),
    course("w", { weighted: true }, 85),
    course("f", {}, 50),
    course("ms", { gradeLevel: 8 }, 95),
  ]);
  assert.equal(t.cumulative.unweightedGpa, (4 + 3 + 0) / 3);
  assert.equal(t.cumulative.weightedGpa, (4 + 4 + 0) / 3);
  assert.equal(t.cumulative.earnedCredits, 2);
  assert.equal(t.cumulative.middleSchoolCredits, 1);
  const rows = t.years[0].rows;
  assert.equal(rows.find((r) => r.id === "f").creditsEarned, 0);
  assert.equal(rows.find((r) => r.id === "ms").creditsEarned, 0);
});

test("an empty transcript has no GPA", () => {
  const t = buildTranscript([]);
  assert.equal(t.cumulative.unweightedGpa, null);
  assert.equal(t.years.length, 0);
});
