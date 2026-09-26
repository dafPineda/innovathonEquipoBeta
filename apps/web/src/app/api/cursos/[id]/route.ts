import { db } from '@/lib/db';
import { sinSesion, usuarioActual } from '@/lib/sesion';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Acciones sobre un curso:
 *   { accion: 'inscribir' }            → inscribe o desinscribe al usuario
 *   { accion: 'me-gusta' }             → pone o quita el me gusta
 *   { accion: 'comentar', texto }      → añade un comentario
 */
export async function POST(req: Request, { params }: Ctx) {
  const yo = await usuarioActual(req);
  if (!yo) return sinSesion();
  const { id } = await params;
  const { accion, texto } = await req.json();

  if (accion === 'inscribir') {
    const llave = { curso_id_estudiante_id: { curso_id: id, estudiante_id: yo } };
    const ya = await db.inscripciones.findUnique({ where: llave });
    if (ya) await db.inscripciones.delete({ where: llave });
    else await db.inscripciones.create({ data: { curso_id: id, estudiante_id: yo } });
  } else if (accion === 'me-gusta') {
    const llave = { curso_id_usuario_id: { curso_id: id, usuario_id: yo } };
    const ya = await db.me_gusta.findUnique({ where: llave });
    if (ya) await db.me_gusta.delete({ where: llave });
    else await db.me_gusta.create({ data: { curso_id: id, usuario_id: yo } });
  } else if (accion === 'comentar') {
    await db.comentarios.create({ data: { curso_id: id, autor_id: yo, texto } });
  } else {
    return Response.json({ error: 'Acción desconocida.' }, { status: 400 });
  }
  return Response.json({ ok: true });
}

/** El tutor borra uno de sus cursos. */
export async function DELETE(req: Request, { params }: Ctx) {
  const yo = await usuarioActual(req);
  if (!yo) return sinSesion();
  const { id } = await params;
  await db.cursos.deleteMany({ where: { id, tutor_id: yo } });
  return Response.json({ ok: true });
}
