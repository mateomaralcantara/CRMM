"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Bell, LogOut, Menu, Search } from "lucide-react";

export function Topbar({ email }: { email?: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-slate-950/60 px-5 py-4 backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <button className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 lg:hidden">
          <Menu size={22} />
        </button>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Sesión activa
          </p>
          <p className="text-sm font-bold text-white">{email || "Usuario"}</p>
        </div>
      </div>

      <div className="hidden w-full max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 md:flex">
        <Search size={17} className="text-slate-500" />
        <input
          placeholder="Buscar en CRM Services..."
          className="border-0 bg-transparent p-0 text-sm shadow-none outline-none ring-0 focus:border-0 focus:bg-transparent focus:ring-0"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
        >
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-400" />
        </button>

        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/[0.1]"
        >
          <LogOut size={16} />
          Salir
        </button>
      </div>
    </header>
  );
}