import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UserRoleAdmin } from "@/components/user-role-admin";
import { getCurrentProfile } from "@/lib/auth/current-user";

export default async function UsuariosPage() {
  const profile = await getCurrentProfile();
  const role = String(profile?.role || "").toLowerCase();

  if (!["super_admin", "admin"].includes(role)) {
    redirect("/");
  }

  return (
    <AppShell>
      <UserRoleAdmin currentRole={role} />
    </AppShell>
  );
}
