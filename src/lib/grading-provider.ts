export type RubricForGrading = {
  name: string;
  criteria: { id: string; name: string; description: string; maxPoints: number }[];
};

export type GradingResult = {
  imageQuality: "ok";
  criteria: { criterionId: string; score: number; feedback: string }[];
  feedback: string;
  total: number;
};

export type ImageQuality = "ok" | "blank" | "not_worksheet" | "blurry" | "unreadable";
export const IMAGE_QUALITIES: ImageQuality[] = ["ok", "blank", "not_worksheet", "blurry", "unreadable"];

export class GradingError extends Error {}
export class GradingValidationError extends GradingError {}
export class GradingRetakeError extends GradingError {
  reason: Exclude<ImageQuality, "ok">;
  constructor(reason: Exclude<ImageQuality, "ok">) {
    super(RETAKE_MESSAGES[reason]);
    this.reason = reason;
  }
}
export class GradingProviderError extends GradingError {
  kind: "offline" | "rate_limit" | "timeout" | "failed";
  constructor(kind: "offline" | "rate_limit" | "timeout" | "failed") {
    super(PROVIDER_MESSAGES[kind]);
    this.kind = kind;
  }
}

const RETAKE_MESSAGES: Record<Exclude<ImageQuality, "ok">, string> = {
  blank: "This photo looks blank. Please retake it with the finished work in frame.",
  not_worksheet: "This doesn't look like a worksheet or written work. Please retake the photo of the assignment.",
  blurry: "This photo is too blurry or small to read. Please retake it in good light, holding the camera steady.",
  unreadable: "This image could not be read. Please retake the photo or upload a different JPEG, PNG, or WebP file.",
};

const PROVIDER_MESSAGES = {
  offline: "The grader could not be reached. Check the connection and try again. Nothing was saved.",
  rate_limit: "The grader is busy right now. Wait a minute and try again. Nothing was saved.",
  timeout: "Grading took too long. Please try again. Nothing was saved.",
  failed: "Grading failed unexpectedly. Please try again. Nothing was saved.",
} as const;

// Fixed request contract for any real provider: deterministic sampling, a fixed JSON schema, and no guessing.
export const GRADING_REQUEST = {
  temperature: 0,
  responseSchema: {
    type: "object",
    required: ["imageQuality", "criteria", "feedback", "total"],
    properties: {
      imageQuality: { enum: IMAGE_QUALITIES },
      criteria: {
        type: "array",
        items: {
          type: "object",
          required: ["criterionId", "score", "feedback"],
          properties: { criterionId: { type: "string" }, score: { type: "number" }, feedback: { type: "string", maxLength: 200 } },
        },
      },
      feedback: { type: "string" },
      total: { type: "number" },
    },
  },
  systemPrompt: [
    "You grade a photo of a student's handwritten or printed work against the supplied rubric.",
    "First judge the image. If it is blank, not a worksheet, blurry, or unreadable, set imageQuality accordingly and score nothing; never guess.",
    "Otherwise set imageQuality to ok and score every criterion exactly once with a number from 0 to its maximum, in steps of 0.5.",
    "Give each criterion a one-line reason (no line breaks) that cites what is visible in the photo.",
    "Set total to the exact sum of the criterion scores. Respond with JSON only, matching the schema.",
  ].join(" "),
} as const;

const round2 = (value: number) => Math.round(value * 100) / 100;

function fail(message: string): never {
  throw new GradingValidationError(`Invalid grading result: ${message}`);
}

// Strictly checks provider output against the rubric; never trust a provider's total.
export function validateGradingResult(raw: unknown, rubric: RubricForGrading): GradingResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("expected an object.");
  const input = raw as Record<string, unknown>;
  if (!IMAGE_QUALITIES.includes(input.imageQuality as ImageQuality)) fail("imageQuality is missing or unknown.");
  if (input.imageQuality !== "ok") throw new GradingRetakeError(input.imageQuality as Exclude<ImageQuality, "ok">);
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
    if (typeof entry.feedback !== "string" || !entry.feedback.trim() || entry.feedback.length > 200 || /[\r\n]/.test(entry.feedback)) {
      fail(`feedback for "${criterion.name}" must be a one-line reason of at most 200 characters.`);
    }
    return { criterionId: criterion.id, score: entry.score, feedback: entry.feedback };
  });

  const total = round2(criteria.reduce((sum, item) => sum + item.score, 0));
  if (typeof input.total !== "number" || input.total !== total) fail("total does not equal the sum of criterion scores.");
  return { imageQuality: "ok", criteria, feedback: input.feedback, total };
}

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function imageSize(bytes: Buffer) {
  if (bytes.length >= 24 && bytes.toString("ascii", 1, 4) === "PNG") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      const marker = bytes[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      }
      offset += 2 + bytes.readUInt16BE(offset + 2);
    }
  }
  return null;
}

// The mock cannot see content. It only catches unreadable, tiny, and blank images from file statistics;
// blur and "not a worksheet" need a real vision provider (see GRADING_REQUEST).
function mockImageQuality(imageBase64: string): ImageQuality {
  const bytes = Buffer.from(imageBase64, "base64");
  const isWebp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (isWebp) return "ok";
  const size = imageSize(bytes);
  if (!size || !size.width || !size.height) return "unreadable";
  if (Math.min(size.width, size.height) < 300) return "blurry";
  return bytes.length / (size.width * size.height) < 0.02 ? "blank" : "ok";
}

// Deterministic stand-in: same image and rubric always yield the same suggestion. No network or key.
export function mockGrade(imageBase64: string, rubric: RubricForGrading): unknown {
  const imageQuality = mockImageQuality(imageBase64);
  if (imageQuality !== "ok") return { imageQuality, criteria: [], total: 0, feedback: "" };
  const seed = hash(`${imageBase64.length}:${imageBase64.slice(0, 4096)}:${imageBase64.slice(-1024)}`);
  const criteria = rubric.criteria.map((criterion, index) => {
    const fraction = 0.6 + (hash(`${seed}:${criterion.id}:${index}`) % 41) / 100;
    const score = round2(Math.round(criterion.maxPoints * fraction * 2) / 2);
    const bounded = Math.min(criterion.maxPoints, Math.max(0, score));
    const level = bounded / criterion.maxPoints >= 0.9 ? "Strong" : bounded / criterion.maxPoints >= 0.75 ? "Solid" : "Developing";
    return { criterionId: criterion.id, score: bounded, feedback: `${level} work on ${criterion.name} (sample feedback from the mock grader).`.replace(/\s+/g, " ").slice(0, 200) };
  });
  const total = round2(criteria.reduce((sum, item) => sum + item.score, 0));
  return {
    imageQuality, criteria, total,
    feedback: `Mock review using "${rubric.name}". This is a sample suggestion, not an AI assessment; a parent should review it.`,
  };
}

export async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new GradingProviderError("timeout")), ms); });
  try { return await Promise.race([work, timeout]); } finally { clearTimeout(timer); }
}

const SIMULATED_FAILURES: Record<string, GradingProviderError["kind"]> = {
  "mock-offline": "offline", "mock-ratelimit": "rate_limit", "mock-timeout": "timeout",
};

async function runProvider(provider: string, imageBase64: string, rubric: RubricForGrading): Promise<unknown> {
  if (provider in SIMULATED_FAILURES) throw new GradingProviderError(SIMULATED_FAILURES[provider]);
  if (provider === "mock-slow") await new Promise((resolve) => setTimeout(resolve, 1500));
  if (provider === "mock-invalid") return { criteria: "nope" };
  if (provider === "mock" || provider === "mock-slow") return mockGrade(imageBase64, rubric);
  throw new GradingValidationError(`Grading provider "${provider}" is not available. Use GRADING_PROVIDER=mock.`);
}

export async function gradeSubmission(imageBase64: string, rubric: RubricForGrading): Promise<GradingResult> {
  if (!imageBase64) throw new GradingValidationError("An image is required.");
  if (!rubric.criteria.length) throw new GradingValidationError("The rubric has no criteria.");
  const provider = process.env.GRADING_PROVIDER || "mock";
  const timeoutMs = Number(process.env.GRADING_TIMEOUT_MS) || 30_000;
  // A real provider would read AI_API_KEY server-side and send GRADING_REQUEST; only the mock exists for now.
  let raw: unknown;
  try {
    raw = await withTimeout(runProvider(provider, imageBase64, rubric), timeoutMs);
  } catch (error) {
    if (error instanceof GradingError) throw error;
    throw new GradingProviderError("failed");
  }
  return validateGradingResult(raw, rubric);
}
