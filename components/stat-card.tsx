import type { LucideIcon } from "lucide-react";

export function StatCard({
  title,
  value,
  icon: Icon,
  helper
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  helper?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/[0.06]">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl transition group-hover:bg-indigo-500/20" />
      <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white">
            {value}
          </p>

          {helper ? (
            <p className="mt-2 text-xs font-medium text-slate-500">{helper}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-indigo-300/10 bg-indigo-500/15 p-3 text-indigo-200 shadow-lg shadow-indigo-950/20">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}