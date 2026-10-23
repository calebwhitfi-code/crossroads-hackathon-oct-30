"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parentFamily } from "@/lib/parent";
import { letterGradeFor } from "@/lib/grades";
import { ApprovalError, checkApproval, scaleToAssignment } from "@/lib/approval";
import { gradeSubmission, GradingValidationError } from "@/lib/grading-provider";
import {
  checked, failedMutation, InputError, numberField, text, type MutationState,
} from "@/lib/form-validation";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CRITERIA = 8;

function finish(path: string): never {
  revalidatePath("/", "layout");
  redirect(path);
}

function imageType(bytes: Buffer) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function saveRubric(_previous: MutationState, form: FormData): Promise<MutationState> {
  let rubricId: string;
  try {
    const familyId = await parentFamily();
    const criteria = [];
    for (let index = 0; index < MAX_CRITERIA; index++) {
      const name = text(form, `name${index}`, "Criterion name", 80, false);
      const description = text(form, `description${index}`, "Criterion description", 500, false);
      const rawPoints = text(form, `maxPoints${index}`, "Criterion points", 30, false);
      if (!name && !description && !rawPoints) continue;
      if (!name) throw new InputError(`Criterion ${index + 1} needs a name.`);
      const points = new FormData();
      points.set("p", rawPoints);
      criteria.push({
        name, description: description || name,
        maxPoints: numberField(points, "p", `Points for "${name}"`, 0.01, 1000),
        position: criteria.length,
      });
    }
    if (!criteria.length) throw new InputError("Add at least one criterion.");
    const rubric = await db.rubric.create({
      data: {
        familyId, isTemplate: true,
        name: text(form, "name", "Rubric name", 120),
        description: text(form, "description", "Rubric description", 500, false) || "Reusable rubric",
        criteria: { create: criteria },
      },
    });
    rubricId = rubric.id;
  } catch (error) {
    return failedMutation(error, form, "Rubric save");
  }
  finish(`/rubrics?saved=rubric&highlight=${rubricId}`);
}

export async function submitPhotoForGrading(_previous: MutationState, form: FormData): Promise<MutationState> {
  let submissionId: string;
  try {
    const familyId = await parentFamily();
    const assignmentId = text(form, "assignmentId", "Assignment ID", 100);
    const rubricId = text(form, "rubricId", "Rubric", 100);
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new InputError("Choose or take a photo of the work.");
    if (file.size > MAX_IMAGE_BYTES) throw new InputError("The photo must be 5 MB or smaller.");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!imageType(bytes)) throw new InputError("The photo must be a JPEG, PNG, or WebP image.");

    const assignment = await db.assignment.findFirst({
      where: { id: assignmentId, course: { student: { familyId } } }, include: { course: true },
    });
    if (!assignment) throw new InputError("That assignment is not available in the active family.");
    if (assignment.course.completed) throw new InputError("Reopen the course before changing its assignments or grades.");
    checkVersionValue(form, assignment.version);
    const rubric = await db.rubric.findFirst({
      where: { id: rubricId, familyId }, include: { criteria: { orderBy: { position: "asc" } } },
    });
    if (!rubric) throw new InputError("Choose a rubric that belongs to your family.");
    if (!rubric.criteria.length) throw new InputError("That rubric has no criteria.");

    // Only the grade output is stored; the photo itself is discarded after grading.
    const result = await gradeSubmission(bytes.toString("base64"), rubric);
    const rubricMax = rubric.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
    const suggested = scaleToAssignment(result.total, rubricMax, assignment.maxPoints);
    const created = await db.$transaction(async (tx) => {
      const current = await tx.assignment.findUnique({ where: { id: assignmentId }, include: { course: true } });
      if (!current || current.course.completed || current.version !== assignment.version) {
        throw new InputError("This assignment changed. Refresh before grading.");
      }
      const submission = await tx.submission.create({
        data: {
          assignmentId, source: "vision", status: "pending_review", feedback: result.feedback,
          suggestedGrade: String(suggested),
          criteriaScores: {
            create: result.criteria.map((score) => {
              const criterion = rubric.criteria.find((item) => item.id === score.criterionId)!;
              return {
                criterionId: criterion.id, earnedPoints: score.score, feedback: score.feedback,
                name: criterion.name, description: criterion.description, maxPoints: criterion.maxPoints,
              };
            }),
          },
        },
      });
      await tx.assignment.update({ where: { id: assignmentId }, data: { rubricId: rubric.id } });
      return submission;
    });
    submissionId = created.id;
  } catch (error) {
    if (error instanceof GradingValidationError || error instanceof ApprovalError) {
      return failedMutation(new InputError(error.message), form, "Photo grading");
    }
    return failedMutation(error, form, "Photo grading");
  }
  finish(`/reviews/${submissionId}?saved=suggested`);
}

function checkVersionValue(form: FormData, version: number) {
  if (numberField(form, "version", "Record version", 0, Number.MAX_SAFE_INTEGER, true) !== version) {
    throw new InputError("This record changed in another tab. Refresh before saving.");
  }
}

export async function approveSubmission(_previous: MutationState, form: FormData): Promise<MutationState> {
  try {
    const familyId = await parentFamily();
    const id = text(form, "submissionId", "Submission ID", 100);
    const feedback = text(form, "feedback", "Feedback", 5000, false);
    if (!checked(form, "approve")) throw new InputError("Review the points and confirm parent approval before saving.");
    await db.$transaction(async (tx) => {
      const submission = await tx.submission.findFirst({
        where: { id, assignment: { course: { student: { familyId } } } },
        include: { assignment: { include: { course: true } } },
      });
      if (!submission) throw new InputError("That submission is not available in the active family.");
      const earnedPoints = numberField(form, "earnedPoints", "Approved points", 0, submission.assignment.maxPoints);
      checkApproval({
        role: "parent", status: submission.status, earnedPoints,
        maxPoints: submission.assignment.maxPoints, courseCompleted: submission.assignment.course.completed,
      });
      const claimed = await tx.submission.updateMany({
        where: { id, status: "pending_review" },
        data: {
          status: "approved", earnedPoints, feedback, approvedAt: new Date(),
          letterGrade: letterGradeFor(earnedPoints / submission.assignment.maxPoints * 100),
        },
      });
      if (claimed.count !== 1) throw new InputError("This submission was already reviewed.");
      await tx.assignment.update({ where: { id: submission.assignmentId }, data: { version: { increment: 1 } } });
      await tx.course.update({ where: { id: submission.assignment.courseId }, data: { version: { increment: 1 } } });
    });
  } catch (error) {
    if (error instanceof ApprovalError) return failedMutation(new InputError(error.message), form, "Approval");
    return failedMutation(error, form, "Grade approval");
  }
  finish("/reviews?saved=approved");
}

export async function discardSubmission(_previous: MutationState, form: FormData): Promise<MutationState> {
  try {
    const familyId = await parentFamily();
    const id = text(form, "submissionId", "Submission ID", 100);
    const result = await db.submission.deleteMany({
      where: { id, status: "pending_review", assignment: { course: { student: { familyId }, completed: false } } },
    });
    if (result.count !== 1) throw new InputError("Only a pending suggestion in an open course can be discarded.");
  } catch (error) {
    return failedMutation(error, form, "Discard suggestion");
  }
  finish("/reviews?saved=discarded");
}
