export type LetterGrade = "A" | "B" | "C" | "D" | "F";

export type GradingScale = { gradeAMin: number; gradeBMin: number; gradeCMin: number; gradeDMin: number };
export const DEFAULT_GRADING_SCALE: GradingScale = { gradeAMin: 90, gradeBMin: 80, gradeCMin: 70, gradeDMin: 60 };

export function gradingScaleFor(course: Partial<GradingScale>): GradingScale {
  return {
    gradeAMin: course.gradeAMin ?? DEFAULT_GRADING_SCALE.gradeAMin,
    gradeBMin: course.gradeBMin ?? DEFAULT_GRADING_SCALE.gradeBMin,
    gradeCMin: course.gradeCMin ?? DEFAULT_GRADING_SCALE.gradeCMin,
    gradeDMin: course.gradeDMin ?? DEFAULT_GRADING_SCALE.gradeDMin,
  };
}

export function isValidGradingScale(scale: GradingScale) {
  const thresholds = [scale.gradeAMin, scale.gradeBMin, scale.gradeCMin, scale.gradeDMin];
  return thresholds.every((value, index) =>
    Number.isFinite(value) && value >= 0 && value <= 100
    && Math.round(value * 100) / 100 === value
    && (index === 0 || value < thresholds[index - 1]),
  );
}

export function formatGradingScale(course: Partial<GradingScale>) {
  const scale = gradingScaleFor(course);
  return `A >= ${scale.gradeAMin}% / B >= ${scale.gradeBMin}% / C >= ${scale.gradeCMin}% / D >= ${scale.gradeDMin}% / F < ${scale.gradeDMin}%`;
}

type SubmissionForGrade = {
  id: string;
  status: string;
  earnedPoints: number | null;
  approvedAt: Date | null;
  createdAt: Date;
};

export const CATEGORY_WEIGHTS = { test: 50, quiz: 20, homework: 30 } as const;
export type AssignmentCategory = keyof typeof CATEGORY_WEIGHTS;
export const CATEGORY_LABELS: Record<AssignmentCategory, string> = { test: "Test", quiz: "Quiz", homework: "Homework" };
export const CATEGORIES = Object.keys(CATEGORY_WEIGHTS) as AssignmentCategory[];

export function isCategory(value: unknown): value is AssignmentCategory {
  return typeof value === "string" && Object.hasOwn(CATEGORY_WEIGHTS, value);
}

export type AssignmentForGrade = {
  maxPoints: number;
  category?: string;
  submissions: SubmissionForGrade[];
};

export type CourseForGrade = Partial<GradingScale> & {
  credits: number;
  weighted: boolean;
  gradeLevel: number;
  academicYear: string;
  completed: boolean;
  assignments: AssignmentForGrade[];
};

export function letterGradeFor(percentage: number, course: Partial<GradingScale> = {}): LetterGrade {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error("Grade percentage must be between 0 and 100.");
  }
  const scale = gradingScaleFor(course);
  if (!isValidGradingScale(scale)) throw new Error("Course grading scale is invalid.");
  if (percentage >= scale.gradeAMin) return "A";
  if (percentage >= scale.gradeBMin) return "B";
  if (percentage >= scale.gradeCMin) return "C";
  if (percentage >= scale.gradeDMin) return "D";
  return "F";
}

export function latestApproved(submissions: SubmissionForGrade[]) {
  return submissions
    .filter((submission) => submission.status === "approved")
    .sort((a, b) =>
      (b.approvedAt?.getTime() ?? 0) - (a.approvedAt?.getTime() ?? 0)
      || b.createdAt.getTime() - a.createdAt.getTime()
      || b.id.localeCompare(a.id),
    )[0] ?? null;
}

// Course % = weighted average of per-category averages (each entry counts equally inside its category).
// Categories with no graded entries are left out and the remaining weights are renormalized.
export function courseGrade(course: { assignments: AssignmentForGrade[] } & Partial<GradingScale>) {
  const entries: Record<AssignmentCategory, number[]> = { test: [], quiz: [], homework: [] };
  let gradedCount = 0;
  for (const assignment of course.assignments) {
    const approved = latestApproved(assignment.submissions);
    if (!approved) continue;
    if (
      !approved.approvedAt || approved.earnedPoints === null
      || !Number.isFinite(approved.earnedPoints) || !Number.isFinite(assignment.maxPoints)
      || assignment.maxPoints <= 0 || approved.earnedPoints < 0
      || approved.earnedPoints > assignment.maxPoints
    ) {
      throw new Error("An approved grade has invalid points or approval metadata.");
    }
    const category = isCategory(assignment.category) ? assignment.category : "homework";
    entries[category].push(Math.round(approved.earnedPoints * 100) / Math.round(assignment.maxPoints * 100) * 100);
    gradedCount++;
  }
  if (!gradedCount) return null;
  let weighted = 0;
  let totalWeight = 0;
  const categories = [];
  for (const category of CATEGORIES) {
    const list = entries[category];
    if (!list.length) continue;
    const average = list.reduce((sum, value) => sum + value, 0) / list.length;
    weighted += average * CATEGORY_WEIGHTS[category];
    totalWeight += CATEGORY_WEIGHTS[category];
    categories.push({ category, average, count: list.length, weight: CATEGORY_WEIGHTS[category] });
  }
  const percentage = Math.min(100, Math.round(weighted / totalWeight * 1e9) / 1e9);
  return { percentage, letter: letterGradeFor(percentage, course), gradedCount, assignmentCount: course.assignments.length, categories };
}

export function studentSummary(courses: CourseForGrade[]) {
  let gradeCredits = 0;
  let unweightedPoints = 0;
  let weightedPoints = 0;
  let earnedCredits = 0;
  let plannedCredits = 0;
  let middleSchoolCredits = 0;
  const points: Record<LetterGrade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

  for (const course of courses) {
    if (course.gradeLevel < 9 || course.gradeLevel > 12) {
      middleSchoolCredits += course.credits;
      continue;
    }
    plannedCredits += course.credits;
    const grade = courseGrade(course);
    if (!grade || course.credits <= 0) continue;
    gradeCredits += course.credits;
    const base = points[grade.letter];
    unweightedPoints += base * course.credits;
    weightedPoints += (base + (course.weighted && grade.letter !== "F" ? 1 : 0)) * course.credits;
    if (course.completed && grade.letter !== "F" && grade.gradedCount === grade.assignmentCount) {
      earnedCredits += course.credits;
    }
  }
  return {
    unweightedGpa: gradeCredits ? unweightedPoints / gradeCredits : null,
    weightedGpa: gradeCredits ? weightedPoints / gradeCredits : null,
    earnedCredits, plannedCredits, middleSchoolCredits,
  };
}

export function formatGpa(value: number | null) {
  if (value === null) return "--";
  const text = value.toFixed(3);
  return text.endsWith("0") ? text.slice(0, -1) : text;
}

export function formatCredits(value: number) {
  return Number(value.toFixed(2)).toString();
}

export function formatPercentage(value: number) {
  return `${(Math.floor(value * 10 + 1e-8) / 10).toFixed(1)}%`;
}
