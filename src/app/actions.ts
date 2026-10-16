"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PROFILE_COOKIE } from "@/lib/profile";

export type ProfileState = { error: string | null };

export async function switchProfile(_previous: ProfileState, formData: FormData): Promise<ProfileState> {
  const value = formData.get("profile");
  if (typeof value !== "string" || !/^(parent|student):[a-z0-9-]+$/.test(value)) {
    return { error: "Choose one of the available demo profiles." };
  }

  const [role, id] = value.split(":");
  try {
    const exists = role === "parent"
      ? await db.family.findUnique({ where: { id }, select: { id: true } })
      : await db.student.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return { error: "That profile is no longer available. Refresh and choose another." };
  } catch (error) {
    console.error("Demo profile lookup failed:", error);
    return { error: "The database is unavailable. Please try switching profiles again." };
  }

  (await cookies()).set(PROFILE_COOKIE, value, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}
