"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("CRM global error", error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-slate-950 text-slate-100">
        <main className="grid min-h-screen place-items-center p-6">
          <section className="w-full max-w-xl rounded-3xl border border-red-400/20 bg-slate-950 p-8 text-center">
            <h1 className="text-2xl font-black">Error temporal del CRM</h1>
            <p className="mt-3 text-sm text-slate-400">
              La aplicación pudo aislar el fallo. Puedes reintentar sin cerrar tu sesión.
            </p>
            <button type="button" onClick={reset} className="mt-6 rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-black text-white">
              Reintentar
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
