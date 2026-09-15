import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

test("Financial Core V1 files are versioned", () => {
  [
    "supabase/financial-core-v1-preflight.sql",
    "supabase/financial-core-v1.sql",
    "supabase/financial-core-v1-hardening.sql",
    "supabase/financial-core-v1-integrity.sql",
    "supabase/financial-core-v1-security-final.sql",
    "app/finanzas/page.tsx",
    "components/financial-dashboard.tsx",
    "components/commission-ledger.tsx",
  ].forEach((file) => assert.equal(exists(file), true, `Missing ${file}`));
});

test("payment is the accounting source of truth", () => {
  const sql = read("supabase/financial-core-v1.sql");
  assert.match(sql, /financial_transactions/);
  assert.match(sql, /snapshot_payment_attribution/);
  assert.match(sql, /sync_payment_to_financial_ledger/);
  assert.match(sql, /status in \('parcial','completado'\)/i);
});

test("payments snapshot responsible affiliate and business unit", () => {
  const sql = read("supabase/financial-core-v1.sql");
  ["affiliate_id", "responsible_id", "business_unit", "attribution_locked"].forEach((field) => {
    assert.match(sql, new RegExp(`\\b${field}\\b`));
  });
});

test("commissions are recalculated from collected cash", () => {
  const core = read("supabase/financial-core-v1.sql");
  const integrity = read("supabase/financial-core-v1-integrity.sql");
  assert.match(core, /recalculate_sale_commissions/);
  assert.match(core, /basis_amount/);
  assert.match(core, /payment_id/);
  assert.match(integrity, /get_sale_commission_rate/);
  assert.match(integrity, /commission_rate/);
});

test("only admin and super_admin are globally privileged", () => {
  const sql = read("supabase/financial-core-v1.sql");
  assert.match(sql, /current_role_text\(\) in \('super_admin','admin'\)/);
  assert.doesNotMatch(sql, /current_role_text\(\) in \('super_admin','admin','supervisor'/);
});

test("opportunities are no longer globally readable", () => {
  const sql = read("supabase/financial-core-v1.sql");
  assert.match(sql, /create policy opportunities_select_scoped/);
  assert.doesNotMatch(sql, /opportunities_select_scoped[\s\S]{0,180}using \(true\)/i);
});

test("cash mutations are restricted and physical payment delete is forbidden", () => {
  const hardening = read("supabase/financial-core-v1-hardening.sql");
  const integrity = read("supabase/financial-core-v1-integrity.sql");

  assert.match(hardening, /payments_update_privileged/);
  assert.match(hardening, /has_role\(array\['supervisor','responsable','vendedor'\]\)/);
  assert.match(integrity, /prevent_payment_physical_delete/);
  assert.match(integrity, /Los pagos no se eliminan/);
});

test("financial attribution cannot be rewritten by normal users", () => {
  const sql = read("supabase/financial-core-v1-security-final.sql");
  assert.match(sql, /protect_affiliate_financial_assignment/);
  assert.match(sql, /enforce_sale_financial_attribution/);
  assert.match(sql, /Solo Admin\/Super Admin puede reasignar responsable o afiliado/);
  assert.match(sql, /commission_rate between 0 and 100/);
});

test("first super admin has a protected bootstrap path", () => {
  const sql = read("supabase/financial-core-v1-integrity.sql");
  const users = read("components/user-role-admin.tsx");

  assert.match(sql, /bootstrap_super_admin/);
  assert.match(sql, /Ya existe un Super Admin activo/);
  assert.match(users, /bootstrap_super_admin/);
  assert.match(users, /Crear primer Super Admin/);
});

test("financial views keep invoker security", () => {
  const sql = read("supabase/financial-core-v1.sql");
  assert.match(sql, /financial_transactions_view[\s\S]*security_invoker\s*=\s*true/i);
  assert.match(sql, /commission_financial_view[\s\S]*security_invoker\s*=\s*true/i);
});

test("financial UI is role-aware", () => {
  const dashboard = read("components/financial-dashboard.tsx");
  const sidebar = read("components/sidebar.tsx");
  const users = read("components/user-role-admin.tsx");

  assert.match(dashboard, /super_admin/);
  assert.match(dashboard, /Vista privada/);
  assert.match(sidebar, /roles: privileged/);
  assert.match(users, /Solo Super Admin/);
});

test("reports use the financial dashboard instead of won sales as income", () => {
  const reports = read("app/reportes/page.tsx");
  assert.match(reports, /FinancialDashboard/);
  assert.doesNotMatch(reports, /sumSalesByStatus/);
});

test("preflight requires the commercial opportunities layer", () => {
  const sql = read("supabase/financial-core-v1-preflight.sql");
  assert.match(sql, /Financial Core requires public\.opportunities/);
  assert.match(sql, /add column if not exists commission_rate/);
});
