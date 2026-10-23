"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parentFamily } from "@/lib/parent";
import { courseInclude } from "@/lib/gradebook";
import { courseGrade, latestApproved, letterGradeFor } from "@/lib/grades";
import {
  academicYear, checked, dueDate, failedMutation, InputError, numberField, text,
  type MutationState,
} from "@/lib/form-validation";

function checkVersion(form: FormData, version: number) {
  if (numberField(form, "version", "Record version", 0, Number.MAX_SAFE_INTEGER, true) !== version) {
    throw new InputError("This record changed in another tab. Refresh before saving.");
  }
}

function finish(path: string): never {
  revalidatePath("/", "layout");
  redirect(path);
}

export async function saveCourse(_previous: MutationState, form: FormData): Promise<MutationState> {
  let courseId: string;
  try {
    const familyId = await parentFamily();
    const id = text(form, "id", "Course ID", 100, false);
    const studentId = text(form, "studentId", "Student", 100);
    const data = {
      studentId,
      name: text(form, "name", "Course name", 120),
      subject: text(form, "subject", "Subject", 80),
      curriculum: text(form, "curriculum", "Curriculum", 160, false) || null,
      credits: numberField(form, "credits", "Credits", 0, 10),
      weighted: checked(form, "weighted"),
      completed: checked(form, "completed"),
      gradeLevel: numberField(form, "gradeLevel", "Grade level", 1, 12, true),
      academicYear: academicYear(form),
    };
    courseId = await db.$transaction(async (tx) => {
      const student = await tx.student.findFirst({ where: { id: studentId, familyId } });
      if (!student) throw new InputError("Choose a student in the active family.");
      if (!id) {
        if (data.completed) throw new InputError("Add and approve assignment grades before completing a course.");
        return (await tx.course.create({ data })).id;
      }
      const current = await tx.course.findFirst({
        where: { id, student: { familyId } }, include: courseInclude,
      });
      if (!current) throw new InputError("That course is not available in the active family.");
      checkVersion(form, current.version);
      if (current.completed && data.completed) {
        throw new InputError("Reopen the course (uncheck completed) before changing it.");
      }
      if (data.completed) {
        const grade = courseGrade(current);
        if (!grade || grade.gradedCount !== current.assignments.length) {
          throw new InputError("Approve a grade for every assignment before completing this course.");
        }
      }
      await tx.course.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
      return id;
    });
  } catch (error) {
    return failedMutation(error, form, "Course save");
  }
  finish(`/courses/${courseId}?saved=course`);
}

export async function deleteCourse(_previous: MutationState, form: FormData): Promise<MutationState> {
  try {
    const familyId = await parentFamily();
    const id = text(form, "id", "Course ID", 100);
    if (!checked(form, "confirm")) throw new InputError("Confirm that you want to delete this course and its grades.");
    await db.$transaction(async (tx) => {
      const course = await tx.course.findFirst({ where: { id, student: { familyId } } });
      if (!course) throw new InputError("That course is not available in the active family.");
      if (course.completed) throw new InputError("Reopen the course before deleting it.");
      checkVersion(form, course.version);
      await tx.course.delete({ where: { id } });
    });
  } catch (error) {
    return failedMutation(error, form, "Course deletion");
  }
  finish("/courses?saved=deleted");
}

export async function saveAssignment(_previous: MutationState, form: FormData): Promise<MutationState> {
  let courseId: string;
  try {
    const familyId = await parentFamily();
    courseId = text(form, "courseId", "Course ID", 100);
    const id = text(form, "id", "Assignment ID", 100, false);
    const data = {
      title: text(form, "title", "Assignment title", 160),
      description: text(form, "description", "Instructions", 5000, false) || null,
      maxPoints: numberField(form, "maxPoints", "Possible points", 0.01, 100000),
      dueAt: dueDate(form),
    };
    await db.$transaction(async (tx) => {
      const course = await tx.course.findFirst({ where: { id: courseId, student: { familyId } } });
      if (!course) throw new InputError("That course is not available in the active family.");
      if (course.completed) throw new InputError("Reopen the course before changing its assignments or grades.");
      if (id) {
        const assignment = await tx.assignment.findFirst({
          where: { id, courseId }, include: { _count: { select: { submissions: true } } },
        });
        if (!assignment) throw new InputError("That assignment is not available in this course.");
        checkVersion(form, assignment.version);
        if (assignment._count.submissions && data.maxPoints !== assignment.maxPoints) {
          throw new InputError("Possible points cannot change after a submission exists. Create a new assignment instead.");
        }
        await tx.assignment.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
      } else {
        await tx.assignment.create({ data: { ...data, courseId } });
      }
      await tx.course.update({ where: { id: courseId }, data: { version: { increment: 1 } } });
    });
  } catch (error) {
    return failedMutation(error, form, "Assignment save");
  }
  finish(`/courses/${courseId}?saved=assignment`);
}

export async function deleteAssignment(_previous: MutationState, form: FormData): Promise<MutationState> {
  let courseId: string;
  try {
    const familyId = await parentFamily();
    const id = text(form, "id", "Assignment ID", 100);
    if (!checked(form, "confirm")) throw new InputError("Confirm that you want to delete this assignment and its grades.");
    courseId = await db.$transaction(async (tx) => {
      const assignment = await tx.assignment.findFirst({
        where: { id, course: { student: { familyId } } }, include: { course: true },
      });
      if (!assignment) throw new InputError("That assignment is not available in the active family.");
      if (assignment.course.completed) throw new InputError("Reopen the course before changing its assignments or grades.");
      checkVersion(form, assignment.version);
      await tx.assignment.delete({ where: { id } });
      await tx.course.update({ where: { id: assignment.courseId }, data: { version: { increment: 1 } } });
      return assignment.courseId;
    });
  } catch (error) {
    return failedMutation(error, form, "Assignment deletion");
  }
  finish(`/courses/${courseId}?saved=deleted`);
}

export async function saveManualGrade(_previous: MutationState, form: FormData): Promise<MutationState> {
  let courseId: string;
  try {
    const familyId = await parentFamily();
    const id = text(form, "assignmentId", "Assignment ID", 100);
    const earnedPoints = numberField(form, "earnedPoints", "Earned points", 0, 100000);
    const expectedMax = numberField(form, "maxPoints", "Possible points", 0.01, 100000);
    const lastApprovedId = text(form, "lastApprovedId", "Previous grade", 100, false);
    const feedback = text(form, "feedback", "Feedback", 5000, false);
    if (!checked(form, "approve")) throw new InputError("Review the points and confirm parent approval before saving.");
    courseId = await db.$transaction(async (tx) => {
      const assignment = await tx.assignment.findFirst({
        where: { id, course: { student: { familyId } } },
        include: {
          course: true,
          submissions: {
            where: { status: "approved" },
            orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 1,
          },
        },
      });
      if (!assignment) throw new InputError("That assignment is not available in the active family.");
      if (assignment.course.completed) throw new InputError("Reopen the course before changing its assignments or grades.");
      checkVersion(form, assignment.version);
      if (expectedMax !== assignment.maxPoints) throw new InputError("Possible points changed. Refresh before grading.");
      if (earnedPoints > assignment.maxPoints) throw new InputError("Earned points cannot exceed possible points.");
      if ((latestApproved(assignment.submissions)?.id ?? "") !== lastApprovedId) {
        throw new InputError("The approved grade changed in another tab. Refresh before grading.");
      }
      await tx.submission.create({
        data: {
          assignmentId: id, source: "manual", status: "approved", earnedPoints, feedback,
          letterGrade: letterGradeFor(earnedPoints / assignment.maxPoints * 100), approvedAt: new Date(),
        },
      });
      await tx.assignment.update({ where: { id }, data: { version: { increment: 1 } } });
      await tx.course.update({ where: { id: assignment.courseId }, data: { version: { increment: 1 } } });
      return assignment.courseId;
    });
  } catch (error) {
    return failedMutation(error, form, "Manual grade approval");
  }
  finish(`/courses/${courseId}?saved=grade`);
}
