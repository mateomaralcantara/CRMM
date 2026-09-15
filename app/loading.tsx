export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6" aria-busy="true" aria-live="polite">
        <div className="h-36 animate-pulse rounded-[1.7rem] border border-white/10 bg-white/[0.04]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-[1.7rem] border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="h-80 animate-pulse rounded-[1.7rem] border border-white/10 bg-white/[0.04]" />
          <div className="h-80 animate-pulse rounded-[1.7rem] border border-white/10 bg-white/[0.04]" />
        </div>
        <p className="text-center text-sm font-semibold text-slate-500">Cargando datos del CRM…</p>
      </div>
    </main>
  );
}
