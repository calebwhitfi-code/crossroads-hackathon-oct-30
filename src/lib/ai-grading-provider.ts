import Anthropic from "@anthropic-ai/sdk";
import { prepareGradingImage } from "./grading-image.ts";
import { GRADING_REQUEST, GradingValidationError, validateAiGradingResult, type RubricForGrading } from "./grading-provider.ts";

export async function aiGrade(imageBase64: string, rubric: RubricForGrading, instructions: string) {
  const image = await prepareGradingImage(Buffer.from(imageBase64, "base64"));
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
    baseURL: "https://api.anthropic.com",
    timeout: 30_000,
    maxRetries: 0,
    logLevel: "off",
    openTelemetry: false,
  });
  const response = await client.messages.create({
    model: process.env.GRADER_MODEL?.trim() || "claude-sonnet-5-5",
    max_tokens: 8192,
    system: GRADING_REQUEST.systemPrompt,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
        { type: "text", text: JSON.stringify({
          assignment_instructions: instructions,
          rubric: { name: rubric.name, criteria: rubric.criteria.map(({ name, description, maxPoints }) => ({ name, description, max_points: maxPoints })) },
        }) },
      ],
    }],
    output_config: { format: { type: "json_schema", schema: GRADING_REQUEST.responseSchema } },
  });
  if (response.stop_reason !== "end_turn") throw new GradingValidationError("The AI grader did not finish a usable suggestion.");
  const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("");
  return validateAiGradingResult(JSON.parse(text), rubric);
}
