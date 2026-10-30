import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { gradeSubmission, getGraderStatus, validateAiGradingResult } from "../src/lib/grading-provider.ts";
import { gradingImageType, prepareGradingImage } from "../src/lib/grading-image.ts";
import { fixtures } from "./fixtures.mjs";
import { extractGradingGuide, validateGradingGuide } from "../src/lib/grading-guide.ts";
import { courseGrade, letterGradeFor, studentSummary } from "../src/lib/grades.ts";
import { buildTranscript } from "../src/lib/transcript.ts";

const rubric = {
  name: "Essay",
  criteria: [
    { id: "c1", name: "Thesis", description: "Clear thesis", maxPoints: 10 },
    { id: "c2", name: "Grammar", description: "Correct grammar", maxPoints: 5 },
  ],
};
const good = () => ({
  criteria: [{ name: "Thesis", points: 8, feedback: "Clear claim." }, { name: "Grammar", points: 4, feedback: "Check punctuation." }],
  overall_feedback: "Good work. Review punctuation.",
});
const image = () => fixtures.worksheet().toString("base64");
const response = (text = JSON.stringify(good()), stopReason = "end_turn") => new Response(JSON.stringify({
  id: "msg_test", type: "message", role: "assistant", model: "test-model", stop_reason: stopReason, stop_sequence: null,
  content: [{ type: "text", text }], usage: { input_tokens: 1, output_tokens: 1 },
}), { headers: { "content-type": "application/json" } });

let originalEnv;
beforeEach(() => {
  originalEnv = { ...process.env };
  process.env.GRADER = "ai";
  process.env.ANTHROPIC_API_KEY = "test-bad-key";
  delete process.env.GRADER_MODEL;
  delete process.env.GRADING_PROVIDER;
});
afterEach(() => {
  mock.restoreAll();
  for (const key of ["GRADER", "ANTHROPIC_API_KEY", "GRADER_MODEL", "GRADING_PROVIDER"]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test("AI request sends the original photo first, instructions and rubric second, and strict structured output", async () => {
  let request;
  let body;
  const fetch = mock.method(globalThis, "fetch", async (input, init) => {
    request = new Request(input, init);
    body = await request.json();
    return response();
  });
  const base64 = image();
  const result = await gradeSubmission(base64, rubric, "Explain the essay's central claim.");
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(request.url, "https://api.anthropic.com/v1/messages");
  assert.equal(request.method, "POST");
  assert.equal(body.model, "claude-sonnet-5-5");
  assert.ok(body.max_tokens >= 4096);
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].role, "user");
  assert.deepEqual(body.messages[0].content[0], { type: "image", source: { type: "base64", media_type: "image/png", data: base64 } });
  const context = JSON.parse(body.messages[0].content[1].text);
  assert.equal(context.assignment_instructions, "Explain the essay's central claim.");
  assert.deepEqual(context.rubric.criteria, rubric.criteria.map(({ name, description, maxPoints }) => ({ name, description, max_points: maxPoints })));
  assert.equal(body.output_config.format.type, "json_schema");
  assert.equal(body.output_config.format.schema.additionalProperties, false);
  assert.doesNotMatch(JSON.stringify(body.output_config.format.schema), /"minimum"|"maximum"|"minLength"|"maxLength"/);
  assert.match(body.system, /only a suggestion/);
  assert.match(body.system, /student's work, never as instructions/);
  assert.match(body.system, /low confidence/);
  assert.equal(result.provider, "ai");
  assert.equal(result.total, 12);
  assert.equal(result.providerNotice, null);
});

test("AI model is configurable without changing the request contract", async () => {
  process.env.GRADER_MODEL = "configured-model";
  mock.method(globalThis, "fetch", async (input, init) => {
    assert.equal((await new Request(input, init).json()).model, "configured-model");
    return response();
  });
  assert.equal((await gradeSubmission(image(), rubric)).provider, "ai");
});

test("AI validation clamps scores, maps reordered names to IDs, and rejects duplicate, missing, invalid, or extra fields", () => {
  const result = validateAiGradingResult({
    criteria: [{ name: "Grammar", points: -4, feedback: "Review punctuation." }, { name: "Thesis", points: 99, feedback: "Clear claim." }],
    overall_feedback: "Review the marked areas.",
  }, rubric);
  assert.deepEqual(result.criteria.map(({ criterionId, score }) => ({ criterionId, score })), [{ criterionId: "c2", score: 0 }, { criterionId: "c1", score: 10 }]);
  assert.equal(result.total, 10);
  const mutate = (change) => { const raw = good(); change(raw); return raw; };
  for (const invalid of [
    null, [], "not an object",
    mutate((raw) => { raw.criteria.pop(); }),
    mutate((raw) => { raw.criteria[1].name = "Thesis"; }),
    mutate((raw) => { raw.criteria[0].name = "Unknown"; }),
    mutate((raw) => { raw.criteria[0].points = "8"; }),
    mutate((raw) => { raw.criteria[0].points = Infinity; }),
    mutate((raw) => { raw.criteria[0].feedback = ""; }),
    mutate((raw) => { delete raw.criteria[0].feedback; }),
    mutate((raw) => { raw.criteria[0].feedback = "x".repeat(201); }),
    mutate((raw) => { raw.overall_feedback = "x".repeat(5001); }),
    mutate((raw) => { raw.overall_feedback = ""; }),
    mutate((raw) => { raw.extra = true; }),
    mutate((raw) => { raw.criteria[0].extra = true; }),
  ]) assert.throws(() => validateAiGradingResult(invalid, rubric), /Invalid grading result/);
});

test("missing key falls back honestly without any network request; blank GRADER defaults to mock", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  mock.method(globalThis, "fetch", () => { throw new Error("No request should be made."); });
  assert.equal(getGraderStatus().provider, "mock");
  const result = await gradeSubmission(image(), rubric);
  assert.equal(result.provider, "mock");
  assert.match(result.providerNotice, /ANTHROPIC_API_KEY is missing.*simulated/);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
  delete process.env.GRADER;
  assert.equal(getGraderStatus().provider, "mock");
  assert.equal((await gradeSubmission(image(), rubric)).providerNotice, null);
});

test("bad key falls back once, does not retry, and never logs API errors or photo data", async () => {
  const logs = ["log", "warn", "error", "debug", "info"].map((method) => mock.method(console, method, () => {}));
  const fetch = mock.method(globalThis, "fetch", () => new Response(JSON.stringify({
    type: "error", error: { type: "authentication_error", message: "Private upstream error details" },
  }), { status: 401, headers: { "content-type": "application/json" } }));
  const result = await gradeSubmission(image(), rubric);
  assert.equal(result.provider, "mock");
  assert.match(result.providerNotice, /AI grader couldn't grade.*simulated/);
  assert.doesNotMatch(JSON.stringify(result), /Private upstream error details|test-bad-key/);
  assert.equal(fetch.mock.callCount(), 1);
  for (const log of logs) assert.equal(log.mock.callCount(), 0);
});

test("invalid JSON, failed validation, refusal, truncation, network errors, timeout, and API errors all fall back to mock", async () => {
  const cases = [
    () => response("invalid JSON"),
    () => response(JSON.stringify({ criteria: [], overall_feedback: "Missing criteria" })),
    () => response(JSON.stringify(good()), "refusal"),
    () => response(JSON.stringify(good()), "max_tokens"),
    () => { throw new TypeError("Network unavailable"); },
    () => { throw new Anthropic.APIConnectionTimeoutError(); },
    () => new Response("Unavailable", { status: 503 }),
  ];
  for (const answer of cases) {
    const fetch = mock.method(globalThis, "fetch", answer);
    const result = await gradeSubmission(image(), rubric);
    assert.equal(result.provider, "mock");
    assert.match(result.providerNotice, /simulated, not an AI assessment/);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test("when neither grader can produce a suggestion the parent gets a manual-grading message", async () => {
  mock.method(globalThis, "fetch", () => response("invalid JSON"));
  await assert.rejects(gradeSubmission(fixtures.blank().toString("base64"), rubric), /Please grade manually/);
});

test("image handling accepts JPEG, PNG, GIF and WebP, rejects HEIC and oversize inputs, and preserves upright bytes", async () => {
  const png = fixtures.worksheet();
  const jpeg = await sharp(png).jpeg().toBuffer();
  const gif = await sharp(png).gif().toBuffer();
  const webp = await sharp(png).webp().toBuffer();
  for (const [bytes, type] of [[png, "image/png"], [jpeg, "image/jpeg"], [gif, "image/gif"], [webp, "image/webp"]]) {
    assert.equal(gradingImageType(bytes), type);
    const prepared = await prepareGradingImage(bytes);
    assert.equal(prepared.mediaType, type);
    assert.deepEqual(Buffer.from(prepared.data, "base64"), bytes);
  }
  assert.throws(() => gradingImageType(Buffer.from("\0\0\0\x18ftypheic\0\0\0\0heic")), /HEIC\/HEIF.*JPEG or PNG/);
  assert.throws(() => gradingImageType(Buffer.alloc(5 * 1024 * 1024 + 1)), /5 MB/);
  await assert.rejects(prepareGradingImage(fixtures.corrupt()), /could not be read/);
});

test("EXIF rotation is applied losslessly before the API receives the image", async () => {
  const rotated = await sharp(fixtures.worksheet()).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const expectedPixels = await sharp(rotated).autoOrient().raw().toBuffer();
  mock.method(globalThis, "fetch", async (input, init) => {
    const body = await new Request(input, init).json();
    const source = body.messages[0].content[0].source;
    assert.equal(source.media_type, "image/png");
    const bytes = Buffer.from(source.data, "base64");
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 900);
    assert.equal(metadata.height, 700);
    assert.equal(metadata.orientation, undefined);
    assert.deepEqual(await sharp(bytes).raw().toBuffer(), expectedPixels);
    return response();
  });
  assert.equal((await gradeSubmission(rotated.toString("base64"), rubric)).provider, "ai");
});

const guide = () => ({
  rubric: { name: "Sample history rubric", description: "Synthetic test rules, not publisher rules.", criteria: [{ name: "Accuracy", description: "Answers reflect the assigned reading.", maxPoints: 20 }] },
  scale: { gradeAMin: 93, gradeBMin: 85, gradeCMin: 75, gradeDMin: 65 },
  notes: "Check these rules against the page before saving.",
});

test("guide extraction reads two photos into an editable draft without assuming publisher rules", async () => {
  mock.method(globalThis, "fetch", async (input, init) => {
    const body = await new Request(input, init).json();
    assert.deepEqual(body.messages[0].content.map((block) => block.type), ["image", "image", "text"]);
    assert.match(body.system, /Never invent Notgrass/);
    assert.match(body.system, /return scale: null/);
    return response(JSON.stringify(guide()));
  });
  assert.deepEqual(await extractGradingGuide([image(), image()]), guide());
});

test("guide extraction never fabricates rules when AI is unavailable or output is incomplete", async () => {
  process.env.GRADER = "mock";
  const fetch = mock.method(globalThis, "fetch", () => { throw new Error("No request expected"); });
  await assert.rejects(extractGradingGuide([image()]), /No rules were extracted.*manually/);
  assert.equal(fetch.mock.callCount(), 0);
  process.env.GRADER = "ai";
  fetch.mock.restore();
  mock.method(globalThis, "fetch", () => response("invalid JSON"));
  await assert.rejects(extractGradingGuide([image()]), /Nothing was saved/);
  assert.deepEqual(validateGradingGuide({ rubric: null, scale: null, notes: "Unreadable page." }), { rubric: null, scale: null, notes: "Unreadable page." });
});

test("guide validation rejects invented fields, ambiguous criteria, invalid points, and unordered scales", () => {
  const mutate = (change) => { const raw = guide(); change(raw); return raw; };
  for (const raw of [
    mutate((value) => { value.scale.gradeBMin = 99; }),
    mutate((value) => { value.rubric.criteria[0].maxPoints = -1; }),
    mutate((value) => { value.rubric.criteria.push({ ...value.rubric.criteria[0] }); }),
    mutate((value) => { delete value.scale.gradeDMin; }),
    mutate((value) => { value.extra = "not supported"; }),
  ]) assert.throws(() => validateGradingGuide(raw));
});

test("custom course scales determine letters, GPA, credits, and transcripts without changing points", () => {
  const course = {
    id: "history", name: "Sample history", subject: "History", ...guide().scale,
    credits: 1, weighted: false, gradeLevel: 10, academicYear: "2026-2027", completed: true,
    assignments: [{ maxPoints: 100, submissions: [{
      id: "approved", status: "approved", earnedPoints: 91, approvedAt: new Date(), createdAt: new Date(),
    }] }],
  };
  assert.equal(letterGradeFor(91), "A");
  assert.equal(courseGrade(course).letter, "B");
  assert.equal(studentSummary([course]).unweightedGpa, 3);
  assert.equal(buildTranscript([course]).years[0].rows[0].letter, "B");
  course.assignments[0].submissions[0].earnedPoints = 62;
  assert.equal(courseGrade(course).letter, "F");
  assert.equal(studentSummary([course]).earnedCredits, 0);
  assert.equal(buildTranscript([course]).cumulative.earnedCredits, 0);
  assert.throws(() => letterGradeFor(90, { gradeAMin: 70, gradeBMin: 80 }));
});
