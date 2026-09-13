import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function parseVersion(version) {
  const clean = String(version || "").replace(/^[^\d]*/, "");
  const [major = 0, minor = 0, patch = 0] = clean
    .split(".")
    .slice(0, 3)
    .map((x) => Number(String(x).replace(/\D.*$/, "")) || 0);

  return { major, minor, patch };
}

function secureNext(version) {
  const v = parseVersion(version);

  if (v.major > 16) return true;
  if (v.major === 16) {
    return v.minor > 3 || (v.minor === 3 && v.patch >= 5);
  }

  return false;
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const nextVersion = pkg.dependencies?.next;

if (!secureNext(nextVersion)) {
  fail(`Next.js ${nextVersion} no cumple el baseline de seguridad: >=16.3.5.`);
}

const nextConfig = fs.readFileSync(path.join(root, "next.config.mjs"), "utf8");

[
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Content-Security-Policy",
].forEach((header) => {
  if (!nextConfig.includes(header)) fail(`Falta header ${header}`);
});

if (/ignoreBuildErrors\s*:\s*true/.test(nextConfig)) {
  fail("next.config ignora errores de TypeScript.");
}

if (/ignoreDuringBuilds\s*:\s*true/.test(nextConfig)) {
  fail("next.config ignora errores de ESLint.");
}

let tracked = [];

try {
  tracked = execSync("git ls-files", { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
} catch {
  fail("No se pudo leer git ls-files.");
}

const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".sql", ".md", ".yml", ".yaml"
]);

const secretRegexes = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?[A-Za-z0-9._-]{12,}/,
  /OPENAI_API_KEY\s*=\s*["']?[A-Za-z0-9._-]{12,}/,
  /ANTHROPIC_API_KEY\s*=\s*["']?[A-Za-z0-9._-]{12,}/,
  /GEMINI_API_KEY\s*=\s*["']?[A-Za-z0-9._-]{12,}/,
  /PAYPAL_CLIENT_SECRET\s*=\s*["']?[A-Za-z0-9._-]{12,}/,
  /DATABASE_URL\s*=\s*["']?(postgres|postgresql):\/\//,
];

for (const rel of tracked) {
  if (rel === "package-lock.json") continue;
  if (rel.startsWith("crm-audit/")) continue;

  const ext = path.extname(rel).toLowerCase();
  if (!textExtensions.has(ext)) continue;

  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;

  const text = fs.readFileSync(full, "utf8");

  for (const re of secretRegexes) {
    if (re.test(text)) {
      fail(`Posible secreto versionado en ${rel}`);
      break;
    }
  }
}

if (failures.length) {
  console.error("\nSECURITY CHECK: FAIL\n");
  failures.forEach((x) => console.error(`- ${x}`));
  process.exit(1);
}

console.log(`SECURITY CHECK: PASS - Next.js ${nextVersion}, headers y secretos OK`);