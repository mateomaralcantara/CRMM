import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ShieldCheck,
  Monitor,
  Clock,
  Mail,
  User,
  Wifi,
  Smartphone,
} from "lucide-react";

type SessionRow = {
  session_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  refreshed_at: string | null;
  not_after: string | null;
  ip_address: string | null;
  user_agent: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getDeviceLabel(userAgent?: string | null) {
  if (!userAgent) return "Dispositivo desconocido";

  const clean = userAgent.toLowerCase();

  if (clean.includes("iphone")) return "iPhone";
  if (clean.includes("ipad")) return "iPad";
  if (clean.includes("android")) return "Android";
  if (clean.includes("windows")) return "Windows";
  if (clean.includes("mac")) return "Mac";
  if (clean.includes("linux")) return "Linux";

  return "Navegador";
}

function getBrowserLabel(userAgent?: string | null) {
  if (!userAgent) return "Navegador desconocido";

  const clean = userAgent.toLowerCase();

  if (clean.includes("edg")) return "Microsoft Edge";
  if (clean.includes("chrome")) return "Chrome";
  if (clean.includes("safari") && !clean.includes("chrome")) return "Safari";
  if (clean.includes("firefox")) return "Firefox";

  return "Navegador";
}

export default async function SesionesPage() {
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

  if (
    profile?.role !== "admin" ||
    !["activo", "active"].includes(String(profile?.status))
  ) {
    redirect("/");
  }

  const { data: sessions, error } = await supabase.rpc("admin_list_sessions");

  if (error) {
    return (
      <main className="space-y-6 p-6">
        <section className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6">
          <h1 className="text-2xl font-black text-white">Sesiones</h1>
          <p className="mt-3 text-sm text-red-200">
            Error cargando sesiones: {error.message}
          </p>
        </section>
      </main>
    );
  }

  const rows = (sessions || []) as SessionRow[];

  return (
    <main className="space-y-6 p-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-300/10 bg-indigo-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
              <ShieldCheck size={14} />
              Seguridad
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white">
              Sesiones de usuarios
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Aquí puedes ver las sesiones activas o recientes de los usuarios
              del CRM.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/50 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Total sesiones
            </p>
            <p className="mt-1 text-3xl font-black text-white">
              {rows.length}
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04]">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Usuario
                </th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Rol
                </th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Dispositivo
                </th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  IP
                </th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Inicio
                </th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Última actividad
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No hay sesiones registradas.
                  </td>
                </tr>
              ) : (
                rows.map((session) => (
                  <tr
                    key={session.session_id}
                    className="transition hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-slate-300">
                          <User size={17} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-black text-white">
                            {session.full_name || "Sin nombre"}
                          </p>

                          <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                            <Mail size={12} />
                            {session.email || "Sin correo"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-black uppercase text-indigo-200">
                        {session.role || "sin rol"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-slate-400">
                          <Monitor size={16} />
                        </div>

                        <div>
                          <p className="font-bold text-slate-200">
                            {getDeviceLabel(session.user_agent)}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-slate-500">
                            <Smartphone size={12} />
                            {getBrowserLabel(session.user_agent)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <p className="flex items-center gap-2 font-mono text-xs text-slate-400">
                        <Wifi size={14} />
                        {session.ip_address || "—"}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-slate-300">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-500" />
                        {formatDate(session.created_at)}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-slate-300">
                      {formatDate(
                        session.refreshed_at ||
                          session.updated_at ||
                          session.created_at
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}