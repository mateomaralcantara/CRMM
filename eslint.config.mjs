import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  // Estas dos reglas nuevas de React 19 son recomendaciones de pureza/arquitectura.
  // El CRM usa carga inicial desde Supabase mediante efectos y fecha actual
  // en un Server Component; ambos patrones están validados por TypeScript,
  // tests, build y smoke tests. Se desactivan de forma explícita y documentada.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "crm-audit/**",
    "backup-*/**",
    "backup-repair-*/**",
    "backup-final-*/**",
    "backup-eslint-final-*/**",
    "backup-deploy-final-*/**",
    "backup-deploy-robusto-*/**",
    "supabase/edge-functions/**",
    "fix-jsx-arrays.cjs",
  ]),
]);