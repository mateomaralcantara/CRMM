import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", ".next", "crm-audit"].includes(entry.name)) continue;
      if (entry.name.startsWith("backup-")) continue;
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }

  return out;
}

test("rutas comerciales críticas existen", () => {
  [
    "app/page.tsx",
    "app/hoy/page.tsx",
    "app/leads/page.tsx",
    "app/oportunidades/page.tsx",
    "app/clientes/page.tsx",
    "app/cotizaciones/page.tsx",
    "app/ventas/page.tsx",
    "app/pagos/page.tsx",
  ].forEach((file) => assert.equal(exists(file), true, `Falta ${file}`));
});

test("Reto 111 contiene las seis unidades de negocio", () => {
  const combined = [
    read("app/leads/page.tsx"),
    read("app/oportunidades/page.tsx"),
    read("supabase/reto-111-specialization.sql"),
  ].join("\n");

  [
    "migrapro",
    "tributario",
    "genelibros",
    "libroseller",
    "b2b",
    "ia_capacitaciones",
  ].forEach((unit) => assert.match(combined, new RegExp(unit)));
});

test("pipeline definitivo está versionado", () => {
  const sql = read("supabase/reto-111-specialization.sql");

  [
    "nuevo",
    "contactado",
    "respondio",
    "calificado",
    "consulta",
    "propuesta",
    "negociacion",
    "pago_pendiente",
    "ganado",
    "en_ejecucion",
    "finalizado",
    "referido_upsell",
  ].forEach((stage) => assert.match(sql, new RegExp(`'${stage}'`)));
});

test("campos comerciales 10/10 existen", () => {
  const sql = read("supabase/reto-111-specialization.sql");

  [
    "business_unit",
    "opportunity_value",
    "sold_amount",
    "collected_amount",
    "outstanding_balance",
    "next_action",
    "next_action_at",
    "conversion_probability",
  ].forEach((field) => assert.match(sql, new RegExp(`\\b${field}\\b`)));
});

test("cobros recalculan ventas con trigger", () => {
  const sql = read("supabase/reto-111-specialization.sql");

  assert.match(sql, /refresh_sale_collection_totals/);
  assert.match(sql, /recalculate_sale_collection/);
  assert.match(sql, /after insert or update or delete on public\.payments/i);
});

test("opportunities tiene RLS y políticas", () => {
  const sql = read("supabase/reto-111-specialization.sql");

  assert.match(sql, /alter table public\.opportunities enable row level security/i);
  assert.match(sql, /opportunities_select_authenticated/);
  assert.match(sql, /opportunities_insert_authenticated/);
  assert.match(sql, /opportunities_update_owner_or_manager/);
  assert.match(sql, /opportunities_delete_manager/);
});

test("TypeScript strict permanece activo", () => {
  const tsconfig = JSON.parse(read("tsconfig.json"));
  assert.equal(tsconfig.compilerOptions?.strict, true);
  assert.equal(tsconfig.compilerOptions?.noEmit, true);
});

test("no hay any explícito en código de aplicación", () => {
  const files = [
    ...walk(path.join(root, "app")),
    ...walk(path.join(root, "components")),
    ...walk(path.join(root, "lib")),
  ].filter((file) => /\.(ts|tsx)$/.test(file));

  const offenders = [];

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");

    if (
      /:\s*any\b/.test(text) ||
      /\bas\s+any\b/.test(text) ||
      /<any>/.test(text) ||
      /Array<any>/.test(text)
    ) {
      offenders.push(path.relative(root, file));
    }
  }

  assert.deepEqual(offenders, []);
});

test("service role nunca aparece en código cliente", () => {
  const files = [
    ...walk(path.join(root, "app")),
    ...walk(path.join(root, "components")),
    ...walk(path.join(root, "lib")),
  ].filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

  const offenders = files
    .filter((file) => /SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file));

  assert.deepEqual(offenders, []);
});

test("archivos .env están ignorados", () => {
  const gitignore = read(".gitignore");
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.local$/m);
});