export class InputError extends Error {}

export type MutationState = {
  error: string | null;
  values?: Record<string, string>;
};

export function text(form: FormData, key: string, label: string, max: number, required = true) {
  const value = form.get(key);
  if (value !== null && typeof value !== "string") throw new InputError(`${label} must be text.`);
  const result = (value ?? "").trim();
  if (required && !result) throw new InputError(`${label} is required.`);
  if (result.length > max) throw new InputError(`${label} must be ${max} characters or fewer.`);
  return result;
}

export function numberField(form: FormData, key: string, label: string, min: number, max: number, integer = false) {
  const raw = text(form, key, label, 30);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new InputError(`${label} must be a number with at most two decimal places and no negative sign or letters.`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new InputError(`${label} must be ${integer ? "a whole number " : ""}between ${min} and ${max}.`);
  }
  return value;
}

export function checked(form: FormData, key: string) {
  const value = form.get(key);
  if (value !== null && value !== "on") throw new InputError("A checkbox value was invalid. Refresh and try again.");
  return value === "on";
}

export function academicYear(form: FormData) {
  const year = text(form, "academicYear", "School year", 9);
  const match = /^(\d{4})-(\d{4})$/.exec(year);
  if (!match || Number(match[1]) < 1900 || Number(match[1]) > 2200 || Number(match[2]) !== Number(match[1]) + 1) {
    throw new InputError("School year must be consecutive years, such as 2026-2027.");
  }
  return year;
}

export function dueDate(form: FormData) {
  const value = text(form, "dueAt", "Due date", 10, false);
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new InputError("Enter a valid due date.");
  }
  return date;
}

export function failedMutation(error: unknown, form: FormData, operation: string): MutationState {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("$") && typeof value === "string") values[key] = value;
  }
  if (error instanceof InputError) return { error: error.message, values };
  console.error(`${operation} failed:`, error);
  return { error: "Your changes could not be saved. Refresh the page and try again.", values };
}
