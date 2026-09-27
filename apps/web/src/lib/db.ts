import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * Cliente de Prisma contra Supabase (DATABASE_URL en .env.local).
 *
 * Va por el driver `pg`: el motor TLS de Prisma no negocia bien con el pooler
 * de Supabase y `pg` sí. El certificado del pooler lo firma la CA de Supabase,
 * que no está en el almacén del sistema: para la demo no lo verificamos.
 *
 * Se crea con la primera consulta, no al importar: así `next build` (que carga
 * las rutas para analizarlas) no necesita DATABASE_URL. Se guarda en
 * globalThis para que el recargado en caliente de `next dev` no abra una
 * conexión nueva en cada cambio.
 */
/**
 * El pooler de Supabase (modo Session) a veces falla al abrir una conexión:
 * la corta ("Connection terminated unexpectedly") o no consigue hueco en su
 * pool ("Failed to connect to database: {:error, :timeout}"). Es intermitente,
 * así que reintentamos un par de veces con una pequeña espera.
 */
const FALLOS_DE_CONEXION = /Connection terminated|Failed to connect to database|timeout expired|ECONNRESET/i;

function esFalloDeConexion(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const causa = (error as Error & { cause?: unknown }).cause;
  return FALLOS_DE_CONEXION.test(error.message) || esFalloDeConexion(causa);
}

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

function crear() {
  const cadena = process.env.DATABASE_URL;
  if (!cadena) throw new Error('Falta DATABASE_URL: ponla en .env.local (o en las variables del deploy).');
  const url = new URL(cadena);
  url.searchParams.delete('sslmode'); // lo decide la opción ssl de abajo
  const adapter = new PrismaPg({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    // Pocas conexiones por proceso: el pool de Supabase es pequeño y cada
    // conexión en modo Session ocupa un hueco fijo.
    max: 3,
    // Soltamos las conexiones inactivas antes de que las corte el pooler.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter }).$extends({
    query: {
      async $allOperations({ args, query }) {
        for (let intento = 1; ; intento++) {
          try {
            return await query(args);
          } catch (error) {
            if (intento >= 3 || !esFalloDeConexion(error)) throw error;
            await esperar(300 * intento);
          }
        }
      },
    },
  });
}

type Cliente = ReturnType<typeof crear>;
const global = globalThis as unknown as { prisma?: Cliente };

function cliente() {
  global.prisma ??= crear();
  return global.prisma;
}

export const db = new Proxy({} as Cliente, {
  get: (_, propiedad) => Reflect.get(cliente(), propiedad),
});
