# Orbita

Plataforma donde el estudiante describe su problema académico a un chat de IA y
Orbita lo conecta con el tutor adecuado. Demo de hackathon: prima que funcione.

- **Proyecto activo:** `apps/web` (Next.js + Clerk) → [documentación de la app](apps/web/README.md)
- **En espera:** `apps/api` + `packages/db` + `packages/credits` (Fastify + Supabase + créditos simbólicos)

## Arranque rápido (Orbita)

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Las claves de desarrollo de Clerk ya están en `apps/web/.env.local`. Para
variables nuevas, parte de `apps/web/.env.example`.

```bash
pnpm lint         # eslint
pnpm build        # next build
pnpm check        # lint + build
```

## Estructura

```
apps/web/                Orbita · Next.js 16 · Clerk · Tailwind 4
  src/app/               rutas (portada, elegir-rol, estudiante, tutor, sign-in/up)
  src/lib/rol.ts         roles: tipos, publicMetadata, exigirRol()
  src/proxy.ts           middleware de Clerk: sesión + rol

apps/api/                API Fastify (stack en espera)
packages/credits/        dominio puro de créditos: reglas, tarifas, liquidación
packages/db/             Supabase: repositorios, migraciones SQL, seed
```

## Stack en espera: Supabase + créditos simbólicos

Se conserva completo y con sus tests en verde por si se decide retomarlo.

```bash
pnpm api:dev        # API Fastify en :4000
pnpm db:migrate     # aplica packages/db/supabase/migrations/*.sql
pnpm db:seed        # datos de demo + smoke test del flujo de créditos
pnpm credits:test   # 35 tests del dominio de créditos
pnpm api:test       # 11 tests de la API
```

Reglas de negocio (comisión 10 %, bono de 20 créditos, ventana facturable de
15–180 min, cancelación tardía 50 %) configurables desde la tabla `app_config` de
Supabase. Los invariantes del dinero:

1. `credit_ledger` es append-only: un trigger rechaza `UPDATE` y `DELETE`.
2. `credit_accounts.balance` es una caché que solo mueve el trigger
   `apply_ledger_entry`, que falla si el saldo quedaría negativo.
3. Nadie escribe el ledger desde un cliente: todo pasa por funciones
   `SECURITY DEFINER` que validan participantes y montos.
4. `GRANT` por columna: nadie se auto-asigna `admin` ni `is_verified`.

## Reglas del proyecto

Ver [AGENTS.md](AGENTS.md): todo el texto de la interfaz en español, secretos solo
en `.env.local`, el id de Clerk es la llave de los usuarios en la base de datos,
nada de pagos reales.
