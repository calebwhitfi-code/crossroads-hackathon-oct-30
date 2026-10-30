import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export type GradingMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
export class GradingImageError extends Error {}

export function gradingImageType(bytes: Buffer): GradingMediaType {
  if (bytes.length > MAX_IMAGE_BYTES) throw new GradingImageError("The photo must be 5 MB or smaller.");
  if (bytes.subarray(4, 8).toString() === "ftyp" && /heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1/.test(bytes.subarray(8, 64).toString())) {
    throw new GradingImageError("HEIC/HEIF photos are not supported. Export the photo as JPEG or PNG and try again.");
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length > 6 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "image/gif";
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  throw new GradingImageError("The photo must be a JPEG, PNG, GIF, or WebP image.");
}

export async function prepareGradingImage(bytes: Buffer) {
  const mediaType = gradingImageType(bytes);
  try {
    const image = sharp(bytes);
    const metadata = await image.metadata();
    if (!metadata.orientation || metadata.orientation === 1) return { mediaType, data: bytes.toString("base64") };
    // Rotation requires new pixels: encode losslessly, never resize or recompress as a lossy JPEG.
    const rotated = await image.autoOrient().png().toBuffer();
    if (rotated.length > MAX_IMAGE_BYTES) {
      throw new GradingImageError("The rotated photo exceeds 5 MB. Upload an upright photo under 5 MB, or grade manually.");
    }
    return { mediaType: "image/png" as const, data: rotated.toString("base64") };
  } catch (error) {
    if (error instanceof GradingImageError) throw error;
    throw new GradingImageError("This image could not be read. Upload a different JPEG, PNG, GIF, or WebP photo, or grade manually.");
  }
}
