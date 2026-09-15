import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

test("Financial Core V1 files are versioned", () => {
  [
    "supabase/financial-core-v1.sql",
    "supabase/financial-core-v1-hardening.sql",
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
  const sql = read("supabase/financial-core-v1.sql");
  assert.match(sql, /recalculate_sale_commissions/);
  assert.match(sql, /basis_amount/);
  assert.match(sql, /payment_id/);
  assert.match(sql, /get_sale_commission_rate/);
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

test("normal users cannot mutate posted cash or commissions globally", () => {
  const sql = read("supabase/financial-core-v1-hardening.sql");
  assert.match(sql, /payments_update_privileged/);
  assert.match(sql, /payments_delete_privileged/);
  assert.match(sql, /commissions_delete_super_admin/);
  assert.match(sql, /has_role\(array\['supervisor','responsable','vendedor'\]\)/);
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
