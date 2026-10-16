"use client";

import { useActionState, useEffect, useRef } from "react";
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
  const picker = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const profiles = families.flatMap((family) => [
    { value: `parent:${family.id}`, name: family.name, role: "Parent", familyId: family.id },
    ...family.students.map((student) => ({
      value: `student:${student.id}`,
      name: `${student.firstName} ${student.lastName}`,
      role: "Student",
      familyId: family.id,
    })),
  ]);
  const activeIndex = profiles.findIndex((profile) => profile.value === active);
  const current = profiles[activeIndex];

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !picker.current?.contains(event.target) && picker.current) {
        picker.current.open = false;
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && picker.current?.open) {
        picker.current.open = false;
        trigger.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="space-y-3">
      {current && (
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-raised text-sm font-semibold text-accent">{activeIndex + 1}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{current.name}</p>
            <p className="text-xs text-muted">{current.role} / Demo profile</p>
          </div>
        </div>
      )}
      <details ref={picker} className="group relative">
        <summary
          ref={trigger}
          className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-page transition-colors hover:bg-accent-hover [&::-webkit-details-marker]:hidden"
        >
          {pending ? "Switching..." : "Switch profile"}
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-180">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-[min(48dvh,24rem)] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-xl lg:top-auto lg:bottom-full lg:mt-0 lg:mb-2">
          <form action={action} onSubmit={() => { if (picker.current) picker.current.open = false; }}>
            {families.map((family) => (
              <fieldset key={family.id} className="min-w-0">
                <legend className="px-3 pt-3 pb-2 text-xs font-semibold tracking-wide text-muted">{family.name}</legend>
                {profiles.map((profile, index) => profile.familyId === family.id && (
                  <button
                    key={profile.value}
                    type="submit"
                    name="profile"
                    value={profile.value}
                    disabled={pending}
                    aria-current={profile.value === active ? "true" : undefined}
                    className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-raised disabled:cursor-wait disabled:opacity-60 ${profile.value === active ? "bg-raised" : ""}`}
                  >
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-page text-sm font-semibold text-accent">{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium">{profile.name}</span>
                      <span className="block text-xs text-muted">{profile.role}{profile.value === active ? " / Current" : ""}</span>
                    </span>
                  </button>
                ))}
              </fieldset>
            ))}
          </form>
        </div>
      </details>
      {state.error && <p id="profile-error" role="alert" className="text-sm text-ink">{state.error}</p>}
    </div>
  );
}
