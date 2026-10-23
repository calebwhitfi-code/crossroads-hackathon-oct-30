export type RubricForGrading = {
  name: string;
  criteria: { id: string; name: string; description: string; maxPoints: number }[];
};

export type GradingResult = {
  criteria: { criterionId: string; score: number; feedback: string }[];
  feedback: string;
  total: number;
};

export class GradingValidationError extends Error {}

const round2 = (value: number) => Math.round(value * 100) / 100;

function fail(message: string): never {
  throw new GradingValidationError(`Invalid grading result: ${message}`);
}

// Strictly checks provider output against the rubric; never trust a provider's total.
export function validateGradingResult(raw: unknown, rubric: RubricForGrading): GradingResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("expected an object.");
  const input = raw as Record<string, unknown>;
  if (typeof input.feedback !== "string" || input.feedback.length > 5000) fail("feedback must be text of at most 5000 characters.");
  if (!Array.isArray(input.criteria)) fail("criteria must be a list.");
  if (input.criteria.length !== rubric.criteria.length) fail("every rubric criterion needs exactly one score.");

  const seen = new Set<string>();
  const criteria = input.criteria.map((item: unknown) => {
    if (typeof item !== "object" || item === null) fail("criterion entries must be objects.");
    const entry = item as Record<string, unknown>;
    const criterion = rubric.criteria.find((candidate) => candidate.id === entry.criterionId);
    if (!criterion) fail("unknown criterion.");
    if (seen.has(criterion.id)) fail("duplicate criterion.");
    seen.add(criterion.id);
    if (typeof entry.score !== "number" || !Number.isFinite(entry.score)) fail(`score for "${criterion.name}" must be a number.`);
    if (entry.score < 0 || entry.score > criterion.maxPoints) fail(`score for "${criterion.name}" must be between 0 and ${criterion.maxPoints}.`);
    if (round2(entry.score) !== entry.score) fail(`score for "${criterion.name}" has more than two decimal places.`);
    if (typeof entry.feedback !== "string" || entry.feedback.length > 2000) fail(`feedback for "${criterion.name}" must be text of at most 2000 characters.`);
    return { criterionId: criterion.id, score: entry.score, feedback: entry.feedback };
  });

  const total = round2(criteria.reduce((sum, item) => sum + item.score, 0));
  if (typeof input.total !== "number" || input.total !== total) fail("total does not equal the sum of criterion scores.");
  return { criteria, feedback: input.feedback, total };
}

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic stand-in: same image and rubric always yield the same suggestion. No network or key.
export function mockGrade(imageBase64: string, rubric: RubricForGrading): unknown {
  const seed = hash(`${imageBase64.length}:${imageBase64.slice(0, 4096)}:${imageBase64.slice(-1024)}`);
  const criteria = rubric.criteria.map((criterion, index) => {
    const fraction = 0.6 + (hash(`${seed}:${criterion.id}:${index}`) % 41) / 100;
    const score = round2(Math.round(criterion.maxPoints * fraction * 2) / 2);
    const bounded = Math.min(criterion.maxPoints, Math.max(0, score));
    const level = bounded / criterion.maxPoints >= 0.9 ? "Strong" : bounded / criterion.maxPoints >= 0.75 ? "Solid" : "Developing";
    return { criterionId: criterion.id, score: bounded, feedback: `${level} work on ${criterion.name} (sample feedback from the mock grader).` };
  });
  const total = round2(criteria.reduce((sum, item) => sum + item.score, 0));
  return {
    criteria, total,
    feedback: `Mock review using "${rubric.name}". This is a sample suggestion, not an AI assessment; a parent should review it.`,
  };
}

export async function gradeSubmission(imageBase64: string, rubric: RubricForGrading): Promise<GradingResult> {
  if (!imageBase64) throw new GradingValidationError("An image is required.");
  if (!rubric.criteria.length) throw new GradingValidationError("The rubric has no criteria.");
  const provider = process.env.GRADING_PROVIDER || "mock";
  // A real provider would read AI_API_KEY server-side here; only the mock exists for now.
  if (provider !== "mock") throw new GradingValidationError(`Grading provider "${provider}" is not available. Use GRADING_PROVIDER=mock.`);
  return validateGradingResult(mockGrade(imageBase64, rubric), rubric);
}
