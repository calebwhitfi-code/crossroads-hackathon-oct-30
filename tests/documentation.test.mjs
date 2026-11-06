import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";

test("README local links and screenshots resolve", () => {
  const file = resolve("README.md");
  const readme = readFileSync(file, "utf8");
  const destinations = [...readme.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g)].map((match) => match[1]);
  assert.ok(destinations.length >= 2);
  for (const destination of destinations) {
    if (/^(https?:|mailto:|#)/.test(destination)) continue;
    assert.ok(existsSync(resolve(dirname(file), destination)), `README link does not resolve: ${destination}`);
  }
  assert.match(readme, /https:\/\/calebwhitfi-code\.github\.io\/crossroads-hackathon-oct-30\//);
});

test("README presents a three-command local run and retained limitations", () => {
  const readme = readFileSync("README.md", "utf8");
  const block = readme.match(/## Run locally[\s\S]*?```sh\r?\n([\s\S]*?)```/)?.[1].trim().split(/\r?\n/);
  assert.equal(block?.length, 3);
  assert.deepEqual(block, [
    "npm ci",
    "cp .env.example .env && npm run db:generate",
    "npm run db:setup && npm run dev",
  ]);
  assert.match(readme, /## Not implemented[\s\S]*Authentication[\s\S]*Calendar[\s\S]*Production persistence/);
});
