import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

test("Performance V1: loading y error boundaries existen", () => {
  assert.equal(exists("app/loading.tsx"), true);
  assert.equal(exists("app/error.tsx"), true);
  assert.equal(exists("app/global-error.tsx"), true);
});

test("Performance V1: auth server se deduplica por request", () => {
  const auth = read("lib/auth/current-user.ts");
  const layout = read("app/layout.tsx");
  assert.match(auth, /cache\(async/);
  assert.match(layout, /getCurrentUser/);
  assert.match(layout, /getCurrentProfile/);
});

test("Performance V1: dashboard y HOY no vuelven a límites masivos", () => {
  const dashboard = read("components/reto111-dashboard.tsx");
  const today = read("app/hoy/page.tsx");
  assert.doesNotMatch(dashboard, /\.limit\((1000|2000)\)/);
  assert.doesNotMatch(today, /\.limit\((1000|2000)\)/);
});

test("Stability V1: detalle de cliente tolera fallos parciales", () => {
  const detail = read("app/clientes/[id]/page.tsx");
  assert.match(detail, /Promise\.allSettled/);
  assert.match(detail, /hasPartialFailure/);
});

test("Stability V1: pagos tienen timeout y siempre liberan loading", () => {
  const payments = read("components/payment-module-fast.tsx");
  assert.match(payments, /AbortSignal\.timeout\(12000\)/);
  assert.match(payments, /finally\s*\{\s*setLoading\(false\)/s);
});

test("Performance V1: Supabase browser reutiliza cliente", () => {
  const client = read("lib/supabase/client.ts");
  assert.match(client, /let browserClient/);
  assert.match(client, /if \(!browserClient\)/);
});
