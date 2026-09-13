// components/app-shell.tsx
// ✅ Este componente NO debe renderizar Sidebar.
// Solo organiza Topbar + contenido.

import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-slate-950">
      <Topbar email={user.email} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] p-5 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}