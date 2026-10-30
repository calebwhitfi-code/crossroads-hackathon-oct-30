"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteAssignment, deleteCourse, saveAssignment, saveCourse, saveManualGrade } from "@/app/gradebook-actions";
import type { MutationState } from "@/lib/form-validation";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/grades";

const initialState: MutationState = { error: null };

export function value(state: MutationState, key: string, fallback: string | number) {
  return state.values?.[key] ?? fallback;
}

function check(state: MutationState, key: string, fallback: boolean) {
  return state.values ? state.values[key] === "on" : fallback;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block min-w-0 text-sm font-medium">
      <span>{label}</span>
      {children}
      {hint && <span className="mt-2 block text-xs leading-5 font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ state }: { state: MutationState }) {
  return state.error ? <p role="alert" className="rounded-xl border border-border bg-raised p-4 text-sm leading-6">{state.error}</p> : null;
}

export function FormFooter({ pending, label, cancel }: { pending: boolean; label: string; cancel: string }) {
  return (
    <div className="flex flex-wrap gap-3 border-t border-border pt-5">
      <button type="submit" disabled={pending} className="button-primary">{pending ? "Saving..." : label}</button>
      <Link href={cancel} className="button-secondary">Cancel</Link>
    </div>
  );
}

type CourseValues = {
  id: string;
  version: number;
  studentId: string;
  name: string;
  subject: string;
  curriculum: string | null;
  credits: number;
  gradeLevel: number;
  academicYear: string;
  weighted: boolean;
  completed: boolean;
};

export function CourseForm({ initial, students }: {
  initial: CourseValues;
  students: { id: string; firstName: string; lastName: string }[];
}) {
  const [state, action, pending] = useActionState(saveCourse, initialState);
  return (
    <form action={action} data-form="course" className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-7">
      <input type="hidden" name="id" value={initial.id} />
      <input type="hidden" name="version" value={initial.version} />
      <FormError state={state} />
      <fieldset disabled={pending} className="grid min-w-0 gap-5 sm:grid-cols-2">
        <Field label="Student">
          <select name="studentId" defaultValue={value(state, "studentId", initial.studentId)} className="form-input" required>
            {students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}
          </select>
        </Field>
        <Field label="Course name">
          <input name="name" defaultValue={value(state, "name", initial.name)} maxLength={120} className="form-input" placeholder="Algebra II" required />
        </Field>
        <Field label="Subject">
          <input name="subject" defaultValue={value(state, "subject", initial.subject)} maxLength={80} className="form-input" placeholder="Mathematics" required />
        </Field>
        <Field label="Curriculum (optional)" hint="Shown beneath the course name. Rubric selection arrives in Phase 3.">
          <input name="curriculum" defaultValue={value(state, "curriculum", initial.curriculum ?? "")} maxLength={160} className="form-input" placeholder="Saxon Math - Algebra 2" />
        </Field>
        <Field label="School year" hint="Use consecutive years, such as 2026-2027.">
          <input name="academicYear" defaultValue={value(state, "academicYear", initial.academicYear)} pattern="[0-9]{4}-[0-9]{4}" maxLength={9} className="form-input" placeholder="2026-2027" required />
        </Field>
        <Field label="Grade level" hint="The student's grade level when taking this course. Only grades 9-12 count toward GPA and earned credits.">
          <input name="gradeLevel" type="number" min="1" max="12" step="1" defaultValue={value(state, "gradeLevel", initial.gradeLevel)} className="form-input" required />
        </Field>
        <Field label="Planned credits" hint="0 for a non-credit course. Up to 10 credits, with at most two decimal places.">
          <input name="credits" type="number" min="0" max="10" step="0.01" defaultValue={value(state, "credits", initial.credits)} className="form-input" required />
        </Field>
        <div className="space-y-4 sm:pt-7">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input name="weighted" type="checkbox" defaultChecked={check(state, "weighted", initial.weighted)} className="mt-1 h-4 w-4 shrink-0 accent-accent" />
            <span>Weighted course<span className="mt-1 block text-xs leading-5 text-muted">Adds 1 GPA point for a passing grade.</span></span>
          </label>
          {initial.id && (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
              <input name="completed" type="checkbox" defaultChecked={check(state, "completed", initial.completed)} className="mt-1 h-4 w-4 shrink-0 accent-accent" />
              <span>Course complete<span className="mt-1 block text-xs leading-5 text-muted">All assignments need approved grades. Passing high-school courses earn credit; failed courses earn none. Uncheck to reopen.</span></span>
            </label>
          )}
        </div>
      </fieldset>
      <FormFooter pending={pending} label={initial.id ? "Save course" : "Create course"} cancel={initial.id ? `/courses/${initial.id}` : "/courses"} />
    </form>
  );
}

export function AssignmentForm({ initial }: { initial: {
  id: string; courseId: string; version: number; title: string; description: string | null; maxPoints: number; category: string; dueAt: string;
} }) {
  const [state, action, pending] = useActionState(saveAssignment, initialState);
  return (
    <form action={action} data-form="assignment" className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-7">
      <input type="hidden" name="id" value={initial.id} />
      <input type="hidden" name="courseId" value={initial.courseId} />
      <input type="hidden" name="version" value={initial.version} />
      <FormError state={state} />
      <fieldset disabled={pending} className="grid min-w-0 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Assignment title">
            <input name="title" defaultValue={value(state, "title", initial.title)} maxLength={160} className="form-input" required />
          </Field>
        </div>
        <Field label="Possible points" hint="Cannot be changed once this assignment has a submission.">
          <input name="maxPoints" type="number" min="0.01" max="100000" step="0.01" defaultValue={value(state, "maxPoints", initial.maxPoints)} className="form-input" required />
        </Field>
        <Field label="Category" hint="Tests 50%, Quizzes 20%, Homework 30% of the course grade.">
          <select name="category" defaultValue={value(state, "category", initial.category)} className="form-input" required>
            {CATEGORIES.map((item) => <option key={item} value={item}>{CATEGORY_LABELS[item]}</option>)}
          </select>
        </Field>
        <Field label="Due date (optional)">
          <input name="dueAt" type="date" defaultValue={value(state, "dueAt", initial.dueAt)} className="form-input" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Instructions (optional)">
            <textarea name="description" defaultValue={value(state, "description", initial.description ?? "")} rows={4} maxLength={5000} className="form-input" />
          </Field>
        </div>
      </fieldset>
      <FormFooter pending={pending} label={initial.id ? "Save assignment" : "Create assignment"} cancel={`/courses/${initial.courseId}`} />
    </form>
  );
}

export function ManualGradeForm({ assignment }: { assignment: {
  id: string; version: number; maxPoints: number; lastApprovedId: string; earnedPoints: number | null; feedback: string;
} }) {
  const [state, action, pending] = useActionState(saveManualGrade, initialState);
  return (
    <form action={action} data-form={`grade-${assignment.id}`} className="mt-4 space-y-5 border-t border-border pt-5">
      <input type="hidden" name="assignmentId" value={assignment.id} />
      <input type="hidden" name="version" value={assignment.version} />
      <input type="hidden" name="maxPoints" value={assignment.maxPoints} />
      <input type="hidden" name="lastApprovedId" value={assignment.lastApprovedId} />
      <FormError state={state} />
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <Field label={`Earned points / ${assignment.maxPoints} possible`}>
          <input name="earnedPoints" type="number" min="0" max={assignment.maxPoints} step="0.01" defaultValue={value(state, "earnedPoints", assignment.earnedPoints ?? "")} className="form-input sm:max-w-48" required />
        </Field>
        <Field label="Feedback (optional)">
          <textarea name="feedback" defaultValue={value(state, "feedback", assignment.feedback)} rows={3} maxLength={5000} className="form-input" />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6">
          <input name="approve" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-accent" />
          <span>I have reviewed these points and approve this grade as the parent.</span>
        </label>
      </fieldset>
      <button type="submit" disabled={pending} className="button-primary">{pending ? "Saving..." : "Approve & save grade"}</button>
      <p className="text-xs leading-5 text-muted">Only the latest approved grade counts. Earlier approvals are kept as history.</p>
    </form>
  );
}

export function DeleteForm({ kind, id, version }: { kind: "course" | "assignment"; id: string; version: number }) {
  const [state, action, pending] = useActionState(kind === "course" ? deleteCourse : deleteAssignment, initialState);
  return (
    <form action={action} data-form={`delete-${kind}`} className="mt-8 space-y-4 rounded-xl border border-border bg-card p-5 sm:p-7">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <h2 className="text-lg font-semibold">Delete {kind}</h2>
      <p className="text-sm leading-6 text-muted">This permanently removes the {kind}{kind === "course" ? ", its assignments," : ""} and all associated grades. This cannot be undone.</p>
      <FormError state={state} />
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6">
        <input name="confirm" type="checkbox" required disabled={pending} className="mt-1 h-4 w-4 shrink-0 accent-accent" />
        <span>I confirm deletion of this {kind} and its saved grades.</span>
      </label>
      <button type="submit" disabled={pending} className="button-secondary">{pending ? "Deleting..." : `Delete ${kind}`}</button>
    </form>
  );
}
