"use client";

import { useActionState } from "react";
import { switchProfile } from "@/app/actions";

type Props = {
  active: string;
  families: {
    id: string;
    name: string;
    students: { id: string; firstName: string; lastName: string }[];
  }[];
};

export function ProfileSwitcher({ active, families }: Props) {
  const [state, action, pending] = useActionState(switchProfile, { error: null });

  return (
    <form action={action} className="space-y-3">
      <label htmlFor="demo-profile" className="block text-xs font-semibold tracking-widest text-muted uppercase">
        Demo profile
      </label>
      <select
        key={active}
        id="demo-profile"
        name="profile"
        defaultValue={active}
        disabled={pending}
        aria-describedby={state.error ? "profile-error" : undefined}
        className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-raised px-3 py-2 text-sm text-ink disabled:opacity-60"
      >
        {families.map((family) => (
          <optgroup key={family.id} label={family.name}>
            <option value={`parent:${family.id}`}>{family.name} / Parent</option>
            {family.students.map((student) => (
              <option key={student.id} value={`student:${student.id}`}>
                {student.firstName} {student.lastName} / Student
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full cursor-pointer rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-page transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Switching..." : "Switch profile"}
      </button>
      {state.error && <p id="profile-error" role="alert" className="text-sm text-ink">{state.error}</p>}
    </form>
  );
}
