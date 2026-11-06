"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { deleteStudent, saveStudent } from "@/app/gradebook-actions";
import type { MutationState } from "@/lib/form-validation";
import { Field, FormError, FormFooter, value } from "@/components/gradebook-forms";

const initialState: MutationState = { error: null };

export function StudentForm({ initial }: { initial: {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel: number;
  academicYear: string;
} }) {
  const [state, action, pending] = useActionState(saveStudent, initialState);
  return (
    <form action={action} data-form="student" className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-7">
      <input type="hidden" name="id" value={initial.id} />
      <FormError state={state} />
      <fieldset disabled={pending} className="grid min-w-0 gap-5 sm:grid-cols-2">
        <Field label="First name">
          <input name="firstName" defaultValue={value(state, "firstName", initial.firstName)} maxLength={80} className="form-input" required />
        </Field>
        <Field label="Last name">
          <input name="lastName" defaultValue={value(state, "lastName", initial.lastName)} maxLength={80} className="form-input" required />
        </Field>
        <Field label="Grade level">
          <input name="gradeLevel" type="number" min="1" max="12" step="1" defaultValue={value(state, "gradeLevel", initial.gradeLevel)} className="form-input" required />
        </Field>
        <Field label="School year" hint="Use consecutive years, such as 2026-2027. The expected graduation year is calculated from this value.">
          <input name="academicYear" defaultValue={value(state, "academicYear", initial.academicYear)} pattern="[0-9]{4}-[0-9]{4}" maxLength={9} className="form-input" placeholder="2026-2027" required />
        </Field>
      </fieldset>
      <FormFooter pending={pending} label={initial.id ? "Save student" : "Add student"} cancel="/" />
    </form>
  );
}

export function DeleteStudentForm({ id, name, hasGradedWork }: {
  id: string;
  name: string;
  hasGradedWork: boolean;
}) {
  const [state, action, pending] = useActionState(deleteStudent, initialState);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-7">
      <h2 className="text-lg font-semibold">Delete student</h2>
      <p className="text-sm leading-6 text-muted">This permanently removes {name}, their courses, assignments, and grades.</p>
      <FormError state={state} />
      <button type="button" className="button-secondary" onClick={() => dialog.current?.showModal()}>Delete student</button>
      <dialog ref={dialog} className="m-auto max-w-lg rounded-xl border border-border bg-card p-0 text-ink backdrop:bg-black/70">
        <form action={action} data-form="delete-student" className="space-y-5 p-6">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="confirm" value="on" />
          <input type="hidden" name="gradedWork" value={hasGradedWork ? "delete" : "none"} />
          <h2 className="text-xl font-semibold">Delete {name}?</h2>
          <p className="text-sm leading-6 text-muted">
            {hasGradedWork
              ? "This student has graded work. Deleting them also permanently removes every course, assignment, approved grade, and transcript record."
              : "This permanently removes the student and all records associated with them."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending} className="button-secondary">{pending ? "Deleting..." : "Confirm permanent deletion"}</button>
            <button type="button" className="button-primary" onClick={() => dialog.current?.close()}>Cancel</button>
          </div>
        </form>
      </dialog>
      <Link href="/" className="text-link">Back to overview</Link>
    </section>
  );
}
