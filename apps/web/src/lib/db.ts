import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * Cliente de Prisma contra Supabase (DATABASE_URL en .env.local).
 *
 * Va por el driver `pg`: el motor TLS de Prisma no negocia bien con el pooler
 * de Supabase y `pg` sí. El certificado del pooler lo firma la CA de Supabase,
 * que no está en el almacén del sistema: para la demo no lo verificamos.
 *
 * Se guarda en globalThis para que el recargado en caliente de `next dev` no
 * abra una conexión nueva en cada cambio.
 */
const global = globalThis as unknown as { prisma?: PrismaClient };

function crear() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete('sslmode'); // lo decide la opción ssl de abajo
  const adapter = new PrismaPg({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  return new PrismaClient({ adapter });
}

export const db = global.prisma ?? crear();
if (process.env.NODE_ENV !== 'production') global.prisma = db;
