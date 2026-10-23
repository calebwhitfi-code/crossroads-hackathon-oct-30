export class ApprovalError extends Error {}

export function checkApproval(input: {
  role: string;
  status: string;
  earnedPoints: number;
  maxPoints: number;
  courseCompleted: boolean;
}) {
  if (input.role !== "parent") throw new ApprovalError("Only a parent can approve grades.");
  if (input.courseCompleted) throw new ApprovalError("Reopen the course before changing its assignments or grades.");
  if (input.status !== "pending_review") throw new ApprovalError("This submission was already reviewed.");
  if (!Number.isFinite(input.earnedPoints) || input.earnedPoints < 0 || input.earnedPoints > input.maxPoints) {
    throw new ApprovalError("Earned points must be between 0 and the possible points.");
  }
}

// Rubric totals can differ from the assignment's possible points, so scale the suggestion.
export function scaleToAssignment(total: number, rubricMax: number, assignmentMax: number) {
  if (rubricMax <= 0) throw new ApprovalError("The rubric has no possible points.");
  return Math.round(total / rubricMax * assignmentMax * 100) / 100;
}
