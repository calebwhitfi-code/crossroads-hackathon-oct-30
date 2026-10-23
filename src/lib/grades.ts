export type LetterGrade = "A" | "B" | "C" | "D" | "F";

type SubmissionForGrade = {
  id: string;
  status: string;
  earnedPoints: number | null;
  approvedAt: Date | null;
  createdAt: Date;
};

export type AssignmentForGrade = {
  maxPoints: number;
  submissions: SubmissionForGrade[];
};

export type CourseForGrade = {
  credits: number;
  weighted: boolean;
  gradeLevel: number;
  academicYear: string;
  completed: boolean;
  assignments: AssignmentForGrade[];
};

export function letterGradeFor(percentage: number): LetterGrade {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error("Grade percentage must be between 0 and 100.");
  }
  if (percentage >= 90) return "A";
  if (percentage >= 80) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 60) return "D";
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

export function courseGrade(course: { assignments: AssignmentForGrade[] }) {
  let earned = 0;
  let possible = 0;
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
    earned += Math.round(approved.earnedPoints * 100);
    possible += Math.round(assignment.maxPoints * 100);
    gradedCount++;
  }
  if (!gradedCount) return null;
  const percentage = earned / possible * 100;
  return { percentage, letter: letterGradeFor(percentage), gradedCount, assignmentCount: course.assignments.length };
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
  return value === null ? "--" : value.toFixed(2);
}

export function formatCredits(value: number) {
  return Number(value.toFixed(2)).toString();
}

export function formatPercentage(value: number) {
  return `${(Math.floor(value * 10 + 1e-8) / 10).toFixed(1)}%`;
}
