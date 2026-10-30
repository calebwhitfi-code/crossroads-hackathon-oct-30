"use client";

import { useActionState } from "react";
import { readGradingGuide, saveGradingGuide } from "@/app/grading-guide-actions";
import { Field, FormError, FormFooter, value } from "@/components/gradebook-forms";
import type { MutationState } from "@/lib/form-validation";
import type { ExtractGuideState, GradingGuideDraft } from "@/lib/grading-guide";
import type { GradingScale } from "@/lib/grades";

type GuideCourse = GradingScale & { id: string; version: number };
const initialExtraction: ExtractGuideState = { error: null, draft: null, revision: 0 };
const initialSave: MutationState = { error: null };
const thresholds = [
  ["gradeAMin", "A"], ["gradeBMin", "B"], ["gradeCMin", "C"], ["gradeDMin", "D"],
] as const;

function GuideReviewForm({ course, draft }: { course: GuideCourse; draft: GradingGuideDraft | null }) {
  const [state, action, pending] = useActionState(saveGradingGuide, initialSave);
  const selected = (key: string, fallback: boolean) => state.values ? state.values[key] === "on" : fallback;
  return (
    <form action={action} data-form="grading-guide" className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-7">
      <input type="hidden" name="courseId" value={course.id} />
      <input type="hidden" name="version" value={course.version} />
      <h2 className="text-xl font-semibold">2. Review or enter rules</h2>
      <FormError state={state} />
      {draft && <p role="status" className="text-sm leading-7 text-accent">AI draft only. Nothing has been saved or applied.</p>}
      {draft?.notes && <p className="text-sm leading-7 break-words whitespace-pre-wrap text-muted">{draft.notes}</p>}
      <fieldset disabled={pending} className="min-w-0 space-y-6">
        <section className="space-y-4" aria-labelledby="guide-rubric-heading">
          <h3 id="guide-rubric-heading" className="text-lg font-semibold">Scoring rubric</h3>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input name="applyRubric" type="checkbox" defaultChecked={selected("applyRubric", Boolean(draft?.rubric))} className="h-4 w-4 accent-accent" />
            <span>Save this rubric as the course default</span>
          </label>
          {!draft?.rubric && <p className="text-xs leading-6 text-muted">No rubric has been extracted. Enter criteria manually, or leave this unchecked to keep the current rubric.</p>}
          <Field label="Rubric name">
            <input name="rubricName" defaultValue={value(state, "rubricName", draft?.rubric?.name ?? "")} maxLength={120} className="form-input" />
          </Field>
          <Field label="Rubric description">
            <textarea name="rubricDescription" defaultValue={value(state, "rubricDescription", draft?.rubric?.description ?? "")} maxLength={500} rows={2} className="form-input" />
          </Field>
          {[0, 1, 2, 3, 4].map((index) => {
            const criterion = draft?.rubric?.criteria[index];
            return (
              <div key={index} className="grid min-w-0 gap-4 rounded-xl border border-border p-4 sm:grid-cols-[1fr_8rem]">
                <Field label={`Criterion ${index + 1}${index ? " (optional)" : ""}`}>
                  <input name={`guideName${index}`} defaultValue={value(state, `guideName${index}`, criterion?.name ?? "")} maxLength={80} className="form-input" />
                </Field>
                <Field label="Max points">
                  <input name={`guideMaxPoints${index}`} type="number" min="0.01" max="1000" step="0.01" defaultValue={value(state, `guideMaxPoints${index}`, criterion?.maxPoints ?? "")} className="form-input" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="What earns these points">
                    <textarea name={`guideDescription${index}`} defaultValue={value(state, `guideDescription${index}`, criterion?.description ?? "")} maxLength={500} rows={2} className="form-input" />
                  </Field>
                </div>
              </div>
            );
          })}
        </section>
        <section className="space-y-4 border-t border-border pt-5" aria-labelledby="guide-scale-heading">
          <h3 id="guide-scale-heading" className="text-lg font-semibold">Letter-grade percentage scale</h3>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input name="applyScale" type="checkbox" defaultChecked={selected("applyScale", Boolean(draft?.scale))} className="h-4 w-4 accent-accent" />
            <span>Apply these percentage cutoffs to this course</span>
          </label>
          {!draft?.scale && <p className="text-xs leading-6 text-muted">No scale has been extracted. These are the current course cutoffs, not assumed publisher rules.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {thresholds.map(([key, letter]) => (
              <Field key={key} label={`${letter} minimum percentage`}>
                <input name={key} type="number" min="0" max="100" step="0.01" defaultValue={value(state, key, draft?.scale?.[key] ?? course[key])} className="form-input" />
              </Field>
            ))}
          </div>
          <p className="text-xs leading-6 text-muted">A must be above B, B above C, and C above D. F is below the D cutoff. Plus/minus scales and category-weight changes are not imported.</p>
        </section>
        <p className="rounded-xl border border-border p-4 text-sm leading-7 text-muted">Changing the scale recalculates existing assignment letters, course letters, GPA, credits, and transcripts using the same approved points. It does not approve any new grades. Existing rubric score snapshots are preserved.</p>
        <label className="flex min-h-11 items-start gap-3 text-sm leading-6">
          <input name="confirm" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-accent" />
          <span>I have checked these rules against the curriculum and approve applying the selected changes to this course.</span>
        </label>
      </fieldset>
      <FormFooter pending={pending} label="Approve & apply rules" cancel={`/courses/${course.id}`} />
    </form>
  );
}

export function GradingGuideForms({ course }: { course: GuideCourse }) {
  const [state, action, pending] = useActionState(readGradingGuide, initialExtraction);
  return (
    <div className="space-y-6">
      <form action={action} data-form="read-guide" className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-7">
        <input type="hidden" name="courseId" value={course.id} />
        <h2 className="text-xl font-semibold">1. Photograph the grading guide</h2>
        <FormError state={state} />
        <fieldset disabled={pending} className="min-w-0">
          <Field label="Rubric and grading-scale photos" hint="Choose one or two pages, up to 5 MB per photo. JPEG, PNG, GIF, or WebP; export HEIC as JPEG or PNG first.">
            <input name="photos" type="file" accept="image/jpeg,image/png,image/gif,image/webp" capture="environment" multiple required className="form-input" />
          </Field>
        </fieldset>
        <button type="submit" disabled={pending} className="button-primary">{pending ? "Reading guide..." : "Read grading guide"}</button>
        {pending && <p role="status" className="text-sm text-accent">Reading the pages. No rules are applied until you review and approve.</p>}
        <p className="text-xs leading-6 text-muted">AI extraction needs internet and an enabled AI grader. Mock does not read publisher rules. You can always enter the rules manually below. Photos are sent to Anthropic only in AI mode and are not stored by Homestead.</p>
      </form>
      <GuideReviewForm key={state.revision} course={course} draft={state.draft} />
    </div>
  );
}
