// app/layout.tsx
// ✅ ÚNICO lugar donde debe renderizarse el Sidebar.

import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { role: string | null; status: string | null } | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    profile = data;
  }

  const isActiveUser =
    user && ["activo", "active"].includes(String(profile?.status));

  return (
    <html lang="es">
      <body className="bg-slate-950 text-slate-100">
        {isActiveUser ? (
          <div className="flex min-h-screen bg-slate-950">
            <Sidebar role={profile?.role} />

            <main className="min-w-0 flex-1 overflow-x-hidden pt-16 lg:pt-0">
              {children}
            </main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}