# Guía rápida de implementación

## Fase 1 — MVP

Incluye:

- Login
- Dashboard
- Clientes
- Leads
- Afiliados
- Servicios
- Ventas
- Pagos
- Comisiones
- Tareas
- Tickets
- Documentos

## Fase 2 — Automatizaciones

Agregar Edge Functions para:

- Crear comisión al cerrar venta.
- Retener comisión si pago no está completo.
- Aprobar comisión cuando pago sea completado.
- Enviar correo de notificación.
- Enviar WhatsApp.
- Escalar tickets vencidos.

## Fase 3 — Producción

Reforzar:

- RLS por sucursal/equipo.
- Roles avanzados.
- Documentos con signed URLs.
- Storage upload real.
- Auditoría por triggers.
- Pruebas E2E.
- Backups.
