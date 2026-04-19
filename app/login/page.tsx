"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);

    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const fullName = String(formData.get("full_name") || "");

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
          });

    if (result.error) {
      setMessage(result.error.message);
    } else {
      router.push("/");
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#1e1b4b,_#020617_55%)] p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-300">CRM Services</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            {mode === "login" ? "Entrar al CRM" : "Crear usuario"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Clientes, afiliados, responsables, ventas y comisiones. Todo en una sola vuelta.
          </p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          {mode === "signup" ? (
            <div>
              <label>Nombre completo</label>
              <input name="full_name" placeholder="Martin Mateo" required />
            </div>
          ) : null}

          <div>
            <label>Correo</label>
            <input name="email" type="email" placeholder="correo@empresa.com" required />
          </div>

          <div>
            <label>Contraseña</label>
            <input name="password" type="password" placeholder="••••••••" required minLength={6} />
          </div>

          {message ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {message}
            </div>
          ) : null}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Procesando..." : mode === "login" ? "Iniciar sesión" : "Registrarme"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-5 w-full text-center text-sm font-semibold text-indigo-300 hover:text-indigo-200"
        >
          {mode === "login" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
        </button>
      </div>
    </main>
  );
}
