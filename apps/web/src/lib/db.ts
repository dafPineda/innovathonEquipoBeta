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
const global = globalThis as unknown as { prisma?: PrismaClient };

function crear() {
  const cadena = process.env.DATABASE_URL;
  if (!cadena) throw new Error('Falta DATABASE_URL: ponla en .env.local (o en las variables del deploy).');
  const url = new URL(cadena);
  url.searchParams.delete('sslmode'); // lo decide la opción ssl de abajo
  const adapter = new PrismaPg({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  return new PrismaClient({ adapter });
}

function cliente() {
  global.prisma ??= crear();
  return global.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get: (_, propiedad) => Reflect.get(cliente(), propiedad),
});
