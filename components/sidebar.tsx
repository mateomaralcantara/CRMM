"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileSignature,
  FileText,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Monitor,
  Receipt,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type SidebarProps = { role?: string | null };
type NavLink = { href: string; label: string; icon: LucideIcon; roles?: string[] };

const privileged = ["super_admin", "admin"];
const commercial = [...privileged, "supervisor", "responsable", "vendedor"];
const affiliateManagement = [...privileged, "supervisor", "responsable"];
const affiliateSelfService = [...affiliateManagement, "afiliado", "promotor"];
const financialView = [...commercial, "afiliado", "promotor"];

const links: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/finanzas", label: "Finanzas", icon: Banknote, roles: financialView },
  { href: "/hoy", label: "HOY", icon: CalendarDays, roles: [...commercial, "soporte"] },
  { href: "/oportunidades", label: "Oportunidades", icon: Target, roles: commercial },
  { href: "/clientes", label: "Clientes", icon: Users, roles: [...commercial, "soporte"] },
  { href: "/leads", label: "Leads", icon: UserPlus, roles: [...commercial, "afiliado", "promotor"] },
  { href: "/afiliados", label: "Afiliados", icon: Handshake, roles: affiliateManagement },
  { href: "/referidos", label: "Referidos", icon: Share2, roles: affiliateSelfService },
  { href: "/servicios", label: "Servicios", icon: BriefcaseBusiness, roles: [...commercial, "soporte", "cliente"] },
  { href: "/solicitudes", label: "Solicitudes", icon: ClipboardList, roles: [...commercial, "soporte", "cliente"] },
  { href: "/cotizaciones", label: "Cotizaciones", icon: FileSignature, roles: commercial },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart, roles: commercial },
  { href: "/pagos", label: "Registrar cobros", icon: Receipt, roles: commercial },
  { href: "/comisiones", label: "Comisiones", icon: BadgeDollarSign, roles: [...privileged, "afiliado", "promotor"] },
  { href: "/tareas", label: "Tareas", icon: CheckSquare, roles: [...commercial, "soporte"] },
  { href: "/tickets", label: "Tickets", icon: LifeBuoy, roles: [...privileged, "supervisor", "responsable", "soporte", "cliente"] },
  { href: "/documentos", label: "Documentos", icon: FileText, roles: [...privileged, "supervisor", "responsable", "soporte", "cliente", "afiliado", "promotor"] },
  { href: "/reportes", label: "Reportes", icon: BarChart3, roles: financialView },
  { href: "/usuarios", label: "Usuarios y roles", icon: ShieldCheck, roles: privileged },
  { href: "/actividad", label: "Actividad", icon: Activity, roles: privileged },
  { href: "/sesiones", label: "Sesiones", icon: Monitor, roles: privileged },
];

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const normalizedRole = String(role || "").toLowerCase();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const visibleLinks = links.filter((link) => !link.roles || link.roles.includes(normalizedRole));

  useEffect(() => {
    const timer = window.setTimeout(() => setIsMobileOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  function renderNavLinks() {
    return visibleLinks.map((link) => {
      const Icon = link.icon;
      const isActive = link.href === "/"
        ? pathname === "/"
        : pathname === link.href || pathname.startsWith(`${link.href}/`);

      return (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive ? "page" : undefined}
          onClick={() => setIsMobileOpen(false)}
          className={[
            "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition",
            "focus:outline-none focus:ring-2 focus:ring-sky-400/60",
            isActive
              ? "bg-gradient-to-r from-indigo-600/90 to-sky-500/80 text-white shadow-lg shadow-indigo-950/30"
              : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
          ].join(" ")}
        >
          <span className={[
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition",
            isActive ? "bg-white/15 text-white" : "bg-white/[0.04] text-slate-400 group-hover:bg-white/[0.08] group-hover:text-white",
          ].join(" ")}>
            <Icon size={18} />
          </span>
          <span className="truncate">{link.label}</span>
        </Link>
      );
    });
  }

  const roleLabel = normalizedRole === "super_admin" ? "Super Admin" : normalizedRole || "usuario";

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 text-white shadow-2xl shadow-black/30 backdrop-blur-2xl lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-400 text-white shadow-lg shadow-indigo-950/40">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-black leading-tight">CRM Services</p>
            <p className="truncate text-xs font-semibold text-slate-400">{roleLabel}</p>
          </div>
        </div>
        <button type="button" onClick={() => setIsMobileOpen((current) => !current)} aria-label={isMobileOpen ? "Cerrar menú" : "Abrir menú"} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-white shadow-lg">
          {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {isMobileOpen ? (
        <button type="button" aria-label="Cerrar menú" onClick={() => setIsMobileOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />
      ) : null}

      <aside className={[
        "fixed bottom-0 left-0 top-0 z-50 w-[86vw] max-w-[340px] border-r border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black/50 transition-transform duration-300 lg:hidden",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-xl font-black tracking-tight text-white">CRM Services</div>
            <p className="mt-1 text-xs font-semibold text-slate-400">{roleLabel} · acceso segmentado</p>
          </div>
          <button type="button" onClick={() => setIsMobileOpen(false)} aria-label="Cerrar menú" className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-white"><X size={20} /></button>
        </div>
        <nav className="h-[calc(100vh-100px)] space-y-1 overflow-y-auto pr-1">{renderNavLinks()}</nav>
      </aside>

      <aside className="sticky top-0 hidden h-screen w-80 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-slate-950/70 p-5 backdrop-blur-2xl lg:flex">
        <div className="mb-5 shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-400 text-white shadow-lg shadow-indigo-950/40"><Sparkles size={22} /></div>
            <div className="min-w-0">
              <div className="truncate text-xl font-black tracking-tight text-white">CRM Services</div>
              <p className="truncate text-xs font-semibold text-slate-400">{roleLabel}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-emerald-300/10 bg-emerald-500/10 px-3 py-2">
            <p className="truncate text-xs font-bold text-emerald-200">Finanzas · permisos por RLS</p>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">{renderNavLinks()}</nav>
      </aside>
    </>
  );
}
