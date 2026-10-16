import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";

export const PROFILE_COOKIE = "homeschool-demo-profile";

export const getProfileContext = cache(async () => {
  const families = await db.family.findMany({
    orderBy: { id: "asc" },
    include: { students: { orderBy: { firstName: "asc" } } },
  });

  const defaultFamily = families[0];
  if (!defaultFamily) {
    throw new Error("No demo families found. Run npm run db:setup before starting the app.");
  }

  const saved = (await cookies()).get(PROFILE_COOKIE)?.value;
  const choices = families.flatMap((family) => [
    { value: `parent:${family.id}`, family, student: null },
    ...family.students.map((student) => ({
      value: `student:${student.id}`, family, student,
    })),
  ]);
  const selected = choices.find((choice) => choice.value === saved);
  if (saved && !selected) console.warn("Unknown demo profile cookie; selecting the default family.");

  const active = selected ?? { value: `parent:${defaultFamily.id}`, family: defaultFamily, student: null };
  return { families, ...active, role: active.student ? "student" as const : "parent" as const };
});
