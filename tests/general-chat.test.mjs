import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

test("Chat General V1 files are versioned", () => {
  [
    "app/chat/page.tsx",
    "app/api/chat/route.ts",
    "components/general-chat.tsx",
  ].forEach((file) => assert.equal(exists(file), true, `Falta ${file}`));
});

test("Chat API requires an authenticated Supabase user", () => {
  const route = read("app/api/chat/route.ts");
  assert.match(route, /createClient/);
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /status:\s*401/);
});

test("OpenAI key stays server-side", () => {
  const route = read("app/api/chat/route.ts");
  const client = read("components/general-chat.tsx");

  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_OPENAI_API_KEY/);
  assert.doesNotMatch(client, /OPENAI_API_KEY/);
  assert.match(route, /store:\s*false/);
});

test("Chat context and message size are bounded", () => {
  const route = read("app/api/chat/route.ts");
  assert.match(route, /MAX_MESSAGES\s*=\s*20/);
  assert.match(route, /MAX_MESSAGE_CHARS\s*=\s*8_000/);
  assert.match(route, /MAX_TOTAL_CHARS\s*=\s*48_000/);
});

test("Chat UI persists locally and calls only the internal API", () => {
  const client = read("components/general-chat.tsx");
  assert.match(client, /crm-general-chat-v1/);
  assert.match(client, /fetch\("\/api\/chat"/);
  assert.doesNotMatch(client, /api\.openai\.com/);
});

test("Chat General is reachable from navigation", () => {
  const sidebar = read("components/sidebar.tsx");
  assert.match(sidebar, /href:\s*"\/chat"/);
  assert.match(sidebar, /Chat General/);
});
