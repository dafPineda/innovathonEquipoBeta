import { db } from '@/lib/db';
import type { MensajeSesion } from '@/lib/tipos';
import { sinSesion, usuarioActual } from '@/lib/sesion';

type Ctx = { params: Promise<{ id: string }> };

function aMensaje(m: { id: string; autor_id: string | null; texto: string | null; enviado_en: Date | null }): MensajeSesion {
  return {
    id: m.id,
    autorId: m.autor_id ?? '',
    texto: m.texto ?? '',
    enviadoEn: (m.enviado_en ?? new Date()).toISOString(),
  };
}

/** Chat entre estudiante y tutor de una solicitud aceptada. */
export async function GET(req: Request, { params }: Ctx) {
  const yo = await usuarioActual(req);
  if (!yo) return sinSesion();
  const { id } = await params;
  const filas = await db.mensajes.findMany({ where: { solicitud_id: id }, orderBy: { enviado_en: 'asc' } });
  return Response.json(filas.map(aMensaje));
}

export async function POST(req: Request, { params }: Ctx) {
  const yo = await usuarioActual(req);
  if (!yo) return sinSesion();
  const { id } = await params;
  const { texto } = await req.json();
  const fila = await db.mensajes.create({ data: { solicitud_id: id, autor_id: yo, texto } });
  return Response.json(aMensaje(fila), { status: 201 });
}
