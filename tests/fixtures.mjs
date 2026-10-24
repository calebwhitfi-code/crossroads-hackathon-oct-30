import { deflateSync } from "node:zlib";

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
}

// Real, decodable RGB PNGs. "blank" is a white page, "text" is dense dark speckle on white
// (a stand-in for handwriting), "dim" is the same speckle at low brightness, "noise" is incompressible.
export function makePng(width, height, kind = "text", seed = 1) {
  const random = seeded(seed);
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const start = y * (width * 3 + 1);
    for (let x = 0; x < width * 3; x++) {
      let value = 255;
      if (kind === "text") value = random() < 0.35 ? Math.floor(random() * 80) : 255;
      if (kind === "dim") value = random() < 0.35 ? Math.floor(random() * 20) : 70;
      if (kind === "noise") value = Math.floor(random() * 256);
      rows[start + 1 + x] = value;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const fixtures = {
  worksheet: () => makePng(700, 900, "text", 7),
  crooked: () => makePng(900, 700, "text", 8),
  dim: () => makePng(700, 900, "dim", 9),
  blank: () => makePng(700, 900, "blank"),
  tiny: () => makePng(120, 160, "text", 3),
  huge: () => makePng(2000, 1800, "noise", 4),
  corrupt: () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]),
  notAnImage: () => Buffer.from("%PDF-1.4 not an image"),
};
