import { createClient } from "@/lib/supabase/server";

export type UserRole =
  | "admin"
  | "supervisor"
  | "responsable"
  | "vendedor"
  | "soporte"
  | "afiliado"
  | "promotor"
  | "cliente";

export async function getCurrentProfile() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function getCurrentRole() {
  const profile = await getCurrentProfile();

  return profile?.role as UserRole | undefined;
}

export function isAdmin(role?: string | null) {
  return role === "admin";
}

export function isPromotor(role?: string | null) {
  return role === "promotor" || role === "afiliado";
}

export function canViewGeneralDashboard(role?: string | null) {
  return role === "admin" || role === "supervisor";
}

export function canManageAll(role?: string | null) {
  return role === "admin";
}