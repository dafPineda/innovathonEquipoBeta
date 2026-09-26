import { db } from '@/lib/db';
import { obtenerSolicitud } from '@/lib/consultas';
import { sinSesion, usuarioActual } from '@/lib/sesion';

/** El tutor acepta (o descarta) una solicitud que le llegó. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const yo = await usuarioActual(req);
  if (!yo) return sinSesion();
  const { id } = await params;
  const { estado } = await req.json();

  await db.solicitudes.update({ where: { id }, data: { estado } });
  return Response.json(await obtenerSolicitud(id));
}
