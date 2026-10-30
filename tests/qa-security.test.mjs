import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/, /AKIA[0-9A-Z]{16}/, /AIza[0-9A-Za-z_-]{35}/, /gh[pousr]_[A-Za-z0-9]{30,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/, /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AI_API_KEY\s*=\s*["']?[A-Za-z0-9_-]{8,}/, /(api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i,
];

test("STEP5 no secrets appear anywhere in the full git history", () => {
  const history = git("log", "--all", "-p", "--no-color");
  assert.ok(history.length > 1000);
  for (const pattern of secretPatterns) assert.doesNotMatch(history, pattern, String(pattern));
});

test("STEP5 .env and the database were never committed and are ignored", () => {
  const files = git("log", "--all", "--name-only", "--pretty=format:").split("\n");
  for (const name of files) assert.ok(!/(^|\/)\.env($|\.(?!example))/.test(name) && !/\.db(-journal|-shm|-wal)?$/.test(name), `committed: ${name}`);
  assert.match(git("ls-files"), /\.env\.example/);
  assert.doesNotMatch(git("ls-files"), /(^|\n)\.env\n|dev\.db/);
  execFileSync("git", ["check-ignore", "-q", ".env"]);
  execFileSync("git", ["check-ignore", "-q", "prisma/dev.db"]);
  assert.match(readFileSync(".env.example", "utf8"), /ANTHROPIC_API_KEY=""/);
});

test("STEP5 working tree has no secrets and no NEXT_PUBLIC_ variables", () => {
  const scan = (directory) => {
    for (const name of readdirSync(directory)) {
      if (["node_modules", ".next", ".git", "qa-artifacts"].includes(name)) continue;
      if (name.startsWith(".env") && name !== ".env.example") continue;
      const path = join(directory, name);
      if (statSync(path).isDirectory()) { scan(path); continue; }
      if (/\.(db|png|ico|tsbuildinfo)$/.test(name) || name === "package-lock.json" || path.endsWith("tests/qa-security.test.mjs")) continue;
      const content = readFileSync(path, "utf8");
      for (const pattern of secretPatterns) assert.doesNotMatch(content, pattern, `${path}: ${pattern}`);
      assert.doesNotMatch(content, /NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN)/, path);
    }
  };
  scan(".");
});

test("STEP5 uploaded photos are not stored or served: no public/ directory, no API or upload routes, no key in client bundle", () => {
  assert.equal(existsSync("public"), false);
  assert.equal(existsSync("src/app/api"), false);
  const server = readFileSync("src/app/grading-actions.ts", "utf8");
  assert.match(server, /image/i);
  assert.doesNotMatch(server, /writeFile|createWriteStream|fs\./);
  const walk = (directory) => readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  for (const file of walk(".next/static").filter((path) => /\.(js|css)$/.test(path))) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /AI_API_KEY|ANTHROPIC_API_KEY|GRADING_PROVIDER|GRADER_MODEL|process\.env\.GRADER|api\.anthropic\.com/, file);
  }
});
