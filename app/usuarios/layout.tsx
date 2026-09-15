import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/current-user";

export default async function UsuariosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  if (!user) redirect("/login");

  const role = String(profile?.role || "").toLowerCase();
  const active = ["activo", "active"].includes(String(profile?.status || ""));

  if (!active || !["super_admin", "admin"].includes(role)) {
    redirect("/");
  }

  return <>{children}</>;
}
