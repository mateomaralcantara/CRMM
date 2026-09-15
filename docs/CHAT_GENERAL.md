# Chat General V1

## Objetivo

Añadir al CRM un chat de preguntas generales para usuarios autenticados sin exponer credenciales en el navegador.

## Arquitectura

- UI: `/chat`
- API interna: `POST /api/chat`
- Proveedor: OpenAI Responses API mediante `fetch` del servidor
- Historial: `localStorage` del navegador
- Contexto enviado: máximo 20 mensajes
- Tamaño por mensaje: máximo 8,000 caracteres
- Tamaño total por petición: máximo 48,000 caracteres
- Las respuestas del proveedor se solicitan con `store: false`

## Variables de entorno

Configurar únicamente en el entorno del servidor:

```text
OPENAI_API_KEY=<server-secret>
OPENAI_MODEL=gpt-5.6-luna
```

`OPENAI_MODEL` es opcional. Si no existe, el servidor usa `gpt-5.6-luna`.

Nunca crear `NEXT_PUBLIC_OPENAI_API_KEY`: una variable `NEXT_PUBLIC_*` se enviaría al navegador.

## Flujo

1. Usuario autenticado abre `/chat`.
2. La UI envía como máximo los últimos 20 mensajes a `/api/chat`.
3. La API valida la sesión con Supabase.
4. La API lee `OPENAI_API_KEY` solo en servidor.
5. La API llama al proveedor y devuelve únicamente texto + nombre del modelo.
6. El navegador conserva la conversación localmente.

## Seguridad y costos

- Usuarios sin sesión reciben HTTP 401.
- Si la clave no está configurada, se devuelve HTTP 503 con un mensaje comprensible.
- El cliente nunca llama directamente a OpenAI.
- El contexto tiene límites para evitar conversaciones ilimitadas y costos innecesarios.
- No se versiona ninguna clave.

## Despliegue

La presencia de este módulo NO autoriza un despliegue automático. Se mantiene la política del repositorio: GitHub Quality Gate completo primero y despliegue manual a Vercel únicamente cuando el código aprobado esté listo para publicación.
