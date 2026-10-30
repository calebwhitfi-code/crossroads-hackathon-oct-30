"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parentFamily } from "@/lib/parent";
import { checked, failedMutation, InputError, numberField, text, type MutationState } from "@/lib/form-validation";
import { extractGradingGuide, GradingGuideError, validateGradingGuide, type ExtractGuideState, type GuideRubric } from "@/lib/grading-guide";
import { gradingImageType, GradingImageError, MAX_IMAGE_BYTES } from "@/lib/grading-image";

export async function readGradingGuide(previous: ExtractGuideState, form: FormData): Promise<ExtractGuideState> {
  try {
    const familyId = await parentFamily();
    const course = await db.course.findFirst({
      where: { id: text(form, "courseId", "Course ID", 100), student: { familyId } },
    });
    if (!course) throw new InputError("That course is not available in the active family.");
    if (course.completed) throw new InputError("Reopen the course before changing its grading guide.");
    const files = form.getAll("photos");
    if (files.length < 1 || files.length > 2) throw new InputError("Choose one or two photos of the rubric and grading scale.");
    const images = [];
    for (const file of files) {
      if (!(file instanceof File) || !file.size) throw new InputError("Choose a photo of the grading guide.");
      if (file.size > MAX_IMAGE_BYTES) throw new InputError("Each photo must be 5 MB or smaller.");
      const bytes = Buffer.from(await file.arrayBuffer());
      gradingImageType(bytes);
      images.push(bytes.toString("base64"));
    }
    return { error: null, draft: await extractGradingGuide(images), revision: previous.revision + 1 };
  } catch (error) {
    const state = failedMutation(error instanceof GradingGuideError || error instanceof GradingImageError ? new InputError(error.message) : error, form, "Read grading guide");
    return { error: state.error, draft: null, revision: previous.revision + 1 };
  }
}

export async function saveGradingGuide(_previous: MutationState, form: FormData): Promise<MutationState> {
  let courseId: string;
  try {
    const familyId = await parentFamily();
    courseId = text(form, "courseId", "Course ID", 100);
    const version = numberField(form, "version", "Record version", 0, Number.MAX_SAFE_INTEGER, true);
    if (!checked(form, "confirm")) throw new InputError("Review the rubric and scale and confirm parent approval before applying them.");
    const applyRubric = checked(form, "applyRubric");
    const applyScale = checked(form, "applyScale");
    if (!applyRubric && !applyScale) throw new InputError("Select a rubric or grading scale to apply.");
    let rubric: GuideRubric | null = null;
    if (applyRubric) {
      const criteria = [];
      for (let index = 0; index < 5; index++) {
        const name = text(form, `guideName${index}`, "Criterion name", 80, false);
        const description = text(form, `guideDescription${index}`, "Criterion description", 500, false);
        const points = text(form, `guideMaxPoints${index}`, "Criterion points", 30, false);
        if (!name && !description && !points) continue;
        if (!name) throw new InputError(`Criterion ${index + 1} needs a name.`);
        criteria.push({ name, description: description || name, maxPoints: numberField(form, `guideMaxPoints${index}`, `Points for criterion ${index + 1}`, 0.01, 1000) });
      }
      rubric = {
        name: text(form, "rubricName", "Rubric name", 120),
        description: text(form, "rubricDescription", "Rubric description", 500, false),
        criteria,
      };
    }
    const scale = applyScale ? {
      gradeAMin: numberField(form, "gradeAMin", "A minimum percentage", 0, 100),
      gradeBMin: numberField(form, "gradeBMin", "B minimum percentage", 0, 100),
      gradeCMin: numberField(form, "gradeCMin", "C minimum percentage", 0, 100),
      gradeDMin: numberField(form, "gradeDMin", "D minimum percentage", 0, 100),
    } : null;
    const guide = validateGradingGuide({ rubric, scale, notes: "" });
    await db.$transaction(async (tx) => {
      const course = await tx.course.findFirst({ where: { id: courseId, student: { familyId } } });
      if (!course) throw new InputError("That course is not available in the active family.");
      if (course.completed) throw new InputError("Reopen the course before changing its grading guide.");
      if (course.version !== version) throw new InputError("This course changed in another tab. Refresh before applying rules.");
      const savedRubric = guide.rubric ? await tx.rubric.create({ data: {
        familyId, isTemplate: true, name: guide.rubric.name, description: guide.rubric.description,
        criteria: { create: guide.rubric.criteria.map((criterion, position) => ({ ...criterion, position })) },
      } }) : null;
      const updated = await tx.course.updateMany({
        where: { id: courseId, version, completed: false },
        data: { ...(guide.scale ?? {}), ...(savedRubric ? { gradingRubricId: savedRubric.id } : {}), version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new InputError("This course changed in another tab. Refresh before applying rules.");
    });
  } catch (error) {
    return failedMutation(error instanceof GradingGuideError ? new InputError(error.message) : error, form, "Apply grading guide");
  }
  revalidatePath("/", "layout");
  redirect(`/courses/${courseId}?saved=guide`);
}
