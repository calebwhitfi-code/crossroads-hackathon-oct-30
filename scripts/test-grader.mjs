import sharp from "sharp";
import { gradeSubmission } from "../src/lib/grading-provider.ts";

process.env.GRADER = "ai";

const rubric = {
  name: "Sample arithmetic",
  criteria: [{ id: "answers", name: "Correct answers", description: "Each correct answer earns 2 points across the five arithmetic questions.", maxPoints: 10 }],
};
const sample = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
  <rect width="640" height="480" fill="white"/>
  <g fill="black" font-family="sans-serif" font-size="32">
    <text x="40" y="55">Arithmetic practice</text>
    <text x="40" y="125">1.  1 + 1 = 2</text>
    <text x="40" y="195">2.  3 + 4 = 7</text>
    <text x="40" y="265">3.  5 - 2 = 3</text>
    <text x="40" y="335">4.  2 * 3 = 6</text>
    <text x="40" y="405">5.  8 / 2 = 4</text>
  </g>
</svg>`;

try {
  const image = await sharp(Buffer.from(sample)).png().toBuffer();
  const result = await gradeSubmission(image.toString("base64"), rubric, "Check all five arithmetic answers against the rubric.");
  console.log(JSON.stringify(result, null, 2));
  if (result.provider !== "ai") process.exitCode = 1;
} catch {
  console.error("Could not grade the sample image. Check the server-side grader configuration or grade manually.");
  process.exitCode = 1;
}
