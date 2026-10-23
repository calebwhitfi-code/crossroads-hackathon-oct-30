import { cookies } from "next/headers";
import { getProfileContext, PROFILE_COOKIE } from "@/lib/profile";
import { InputError } from "@/lib/form-validation";

export async function parentFamily() {
  const profile = await getProfileContext();
  const saved = (await cookies()).get(PROFILE_COOKIE)?.value;
  if (profile.role !== "parent" || (saved && saved !== profile.value)) {
    throw new InputError("Switch to a valid parent profile to make changes.");
  }
  return profile.family.id;
}
