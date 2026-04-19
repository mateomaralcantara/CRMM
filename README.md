# CRM Services — Supabase MVP Completo

CRM Services es un starter MVP para una empresa multiservicios con gestión de:

- Clientes
- Leads
- Afiliados
- Referidos
- Servicios
- Solicitudes de servicio
- Cotizaciones
- Ventas
- Pagos
- Comisiones
- Tareas
- Tickets
- Documentos
- Reportes
- Roles y permisos básicos
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Row Level Security

## Stack incluido

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Supabase Storage
- Supabase SSR
- Lucide Icons

---

## 1. Crear proyecto en Supabase

1. Crea un proyecto nuevo en Supabase.
2. Entra a **SQL Editor**.
3. Copia y ejecuta completo el archivo:

```bash
supabase/schema.sql
```

4. Ve a **Authentication > Users** y crea tu primer usuario.
5. Luego vuelve al SQL Editor y convierte tu usuario en administrador:

```sql
update public.profiles
set role = 'admin', full_name = 'Administrador CRM Services'
where email = 'TU_CORREO_AQUI';
```

---

## 2. Configurar variables de entorno

Copia `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Completa:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
```

Lo consigues en Supabase:

**Project Settings > API**

---

## 3. Instalar dependencias

```bash
npm install
```

---

## 4. Ejecutar el CRM

```bash
npm run dev
```

Luego abre:

```bash
http://localhost:3000
```

---

## 5. Estructura principal

```bash
app/
  login/
  dashboard/
  clientes/
  leads/
  afiliados/
  referidos/
  servicios/
  solicitudes/
  cotizaciones/
  ventas/
  pagos/
  comisiones/
  tareas/
  tickets/
  documentos/
  reportes/

components/
  app-shell.tsx
  crud-module.tsx
  sidebar.tsx
  stat-card.tsx
  topbar.tsx

lib/
  supabase/
  utils.ts

supabase/
  schema.sql
  edge-functions/
```

---

## 6. Importante antes de producción

Este proyecto es un MVP funcional/base. Para producción real debes reforzar:

- Políticas RLS más estrictas por cada flujo.
- Validación avanzada de formularios.
- Signed URLs para documentos privados.
- Integración real con WhatsApp Cloud API.
- Edge Functions conectadas a Resend, Stripe o WhatsApp.
- Backups, monitoreo y logs.
- Auditoría completa por trigger.
- Pruebas automatizadas.

---

## 7. Comando recomendado para desarrollo

```bash
npm run dev
```

Listo. Dale candela.
