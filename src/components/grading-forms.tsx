"use client";

import { useActionState, useState } from "react";
import { approveSubmission, discardSubmission, saveRubric, submitPhotoForGrading } from "@/app/grading-actions";
import type { MutationState } from "@/lib/form-validation";
import { Field, FormError, FormFooter, value } from "@/components/gradebook-forms";

const initialState: MutationState = { error: null };

export function RubricForm() {
  const [state, action, pending] = useActionState(saveRubric, initialState);
  return (
    <form action={action} data-form="rubric" className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-7">
      <FormError state={state} />
      <fieldset disabled={pending} className="grid min-w-0 gap-5 sm:grid-cols-2">
        <Field label="Rubric name">
          <input name="name" defaultValue={value(state, "name", "")} maxLength={120} className="form-input" required />
        </Field>
        <Field label="Description (optional)">
          <input name="description" defaultValue={value(state, "description", "")} maxLength={500} className="form-input" />
        </Field>
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="grid min-w-0 gap-3 rounded-xl border border-border p-4 sm:col-span-2 sm:grid-cols-[1fr_8rem]">
            <Field label={`Criterion ${index + 1}${index === 0 ? "" : " (optional)"}`}>
              <input name={`name${index}`} defaultValue={value(state, `name${index}`, "")} maxLength={80} className="form-input" required={index === 0} />
            </Field>
            <Field label="Max points">
              <input name={`maxPoints${index}`} type="number" min="0.01" max="1000" step="0.01" defaultValue={value(state, `maxPoints${index}`, "")} className="form-input" required={index === 0} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="What earns full points">
                <input name={`description${index}`} defaultValue={value(state, `description${index}`, "")} maxLength={500} className="form-input" />
              </Field>
            </div>
          </div>
        ))}
      </fieldset>
      <FormFooter pending={pending} label="Save rubric" cancel="/rubrics" />
    </form>
  );
}

export function PhotoGradeForm({ assignment, rubrics }: {
  assignment: { id: string; version: number; rubricId: string | null };
  rubrics: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(submitPhotoForGrading, initialState);
  const [fileError, setFileError] = useState<string | null>(null);
  return (
    <form action={action} data-form="photo-grade" onSubmit={(event) => { if (fileError) event.preventDefault(); }} className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-7">
      <input type="hidden" name="assignmentId" value={assignment.id} />
      <input type="hidden" name="version" value={assignment.version} />
      <FormError state={state} />
      {fileError && <p role="alert" className="rounded-xl border border-border bg-raised p-4 text-sm leading-6">{fileError}</p>}
      {pending && <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-accent">Grading your photo. This can take a few seconds...</p>}
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        <Field label="Rubric">
          <select name="rubricId" defaultValue={value(state, "rubricId", assignment.rubricId ?? rubrics[0]?.id ?? "")} className="form-input" required>
            {rubrics.map((rubric) => <option key={rubric.id} value={rubric.id}>{rubric.name}</option>)}
          </select>
        </Field>
        <Field label="Photo of the work" hint="Take a photo or choose one and grading starts right away. JPEG, PNG, or WebP up to 5 MB. The photo is graded and not stored.">
          <input name="photo" type="file" accept="image/*" capture="environment" className="form-input" required onChange={(event) => {
            const input = event.target;
            const file = input.files?.[0];
            if (file && file.size > 5 * 1024 * 1024) {
              setFileError(`That photo is ${(file.size / 1048576).toFixed(1)} MB. Choose or retake a photo under 5 MB.`);
              input.value = "";
            } else {
              setFileError(null);
              // Choosing or taking a photo starts grading right away.
              if (file) input.form?.requestSubmit();
            }
          }} />
        </Field>
      </fieldset>
      <button type="submit" disabled={pending} className="button-primary">{pending ? "Grading..." : "Grade photo"}</button>
      <p className="text-xs leading-5 text-muted">The result is only a suggestion. A parent must approve it before it counts.</p>
    </form>
  );
}

export function ApproveForm({ submission }: {
  submission: { id: string; maxPoints: number; suggested: number; feedback: string };
}) {
  const [state, action, pending] = useActionState(approveSubmission, initialState);
  return (
    <form action={action} data-form="approve" className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-7">
      <input type="hidden" name="submissionId" value={submission.id} />
      <FormError state={state} />
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <Field label={`Approved points / ${submission.maxPoints} possible`} hint="Adjust the suggested points if needed.">
          <input name="earnedPoints" type="number" min="0" max={submission.maxPoints} step="0.01" defaultValue={value(state, "earnedPoints", submission.suggested)} className="form-input sm:max-w-48" required />
        </Field>
        <Field label="Feedback">
          <textarea name="feedback" defaultValue={value(state, "feedback", submission.feedback)} rows={4} maxLength={5000} className="form-input" />
        </Field>
      </fieldset>
      <button type="submit" name="approve" value="on" disabled={pending} className="button-primary">{pending ? "Saving..." : "Approve & save grade"}</button>
      <p className="text-xs leading-5 text-muted">Approving as the parent saves these points to the gradebook. Change the points first to override the suggestion.</p>
    </form>
  );
}

export function DiscardForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(discardSubmission, initialState);
  return (
    <form action={action} data-form="discard" className="space-y-3">
      <input type="hidden" name="submissionId" value={id} />
      <FormError state={state} />
      <button type="submit" disabled={pending} className="button-secondary">{pending ? "Discarding..." : "Discard suggestion"}</button>
    </form>
  );
}
