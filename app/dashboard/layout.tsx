// app/dashboard/layout.tsx
// ✅ Este layout NO debe renderizar Sidebar.
// El Sidebar ya vive en app/layout.tsx.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["activo", "active"].includes(String(profile.status))) {
    redirect("/login");
  }

  return <>{children}</>;
}