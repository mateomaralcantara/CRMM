# Política de despliegue

Este repositorio usa una política **GitHub primero, Vercel después**.

## Regla obligatoria

Los despliegues automáticos de Vercel desde Git están desactivados mediante `vercel.json`.

Ningún cambio debe desplegarse a Vercel mientras no se cumplan todos estos puntos:

1. El cambio está en una rama separada.
2. Existe un Pull Request contra `main`.
3. `CRM Quality Gate` termina completamente en verde.
4. Se revisan errores funcionales, de seguridad y de integración pendientes.
5. Las migraciones de base de datos requeridas ya están aplicadas y verificadas, cuando corresponda.
6. El código aprobado queda integrado en `main`.
7. Solo entonces se realiza un despliegue manual a Vercel.

## Prohibido

- Desplegar automáticamente cada push o Pull Request.
- Usar Vercel como sustituto del CI de GitHub.
- Publicar una interfaz que dependa de una migración de Supabase todavía no aplicada.
- Desplegar con gates de lint, TypeScript, tests, seguridad, build o audit fallando.

## Fuente de verdad

`main` + `CRM Quality Gate` en verde representa el estado aprobado de código. Vercel es únicamente el destino de publicación posterior.
