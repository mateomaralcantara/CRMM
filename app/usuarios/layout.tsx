import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function UsuariosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

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
    .single();

  if (profile?.role !== "admin" || profile?.status !== "activo") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}