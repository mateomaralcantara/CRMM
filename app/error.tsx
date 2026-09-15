"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("CRM route error", error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center p-6">
      <section className="w-full max-w-xl rounded-[1.7rem] border border-red-400/20 bg-red-500/[0.07] p-7 text-center shadow-2xl shadow-black/20">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-200">
          <TriangleAlert size={25} />
        </div>
        <h1 className="mt-5 text-2xl font-black text-white">No pudimos cargar esta sección</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Puede ser una interrupción temporal de red o de datos. Tus cambios guardados no se pierden.
        </p>
        <button type="button" onClick={reset} className="crm-button-primary mt-6">
          <RefreshCw size={16} />
          Reintentar
        </button>
      </section>
    </main>
  );
}
