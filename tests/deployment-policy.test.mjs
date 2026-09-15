import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

test("Vercel automatic Git deployments remain disabled", () => {
  const config = readJson("vercel.json");
  assert.equal(config?.git?.deploymentEnabled, false);
});
