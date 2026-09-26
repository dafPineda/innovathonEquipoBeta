import { db } from '@/lib/db';
import { listarCursos } from '@/lib/consultas';
import { sinSesion, usuarioActual } from '@/lib/sesion';

/** Muro de cursos: todos, del más nuevo al más viejo, con inscritos, me gusta y comentarios. */
export async function GET(req: Request) {
  const yo = await usuarioActual(req);
  if (!yo) return sinSesion();
  return Response.json(await listarCursos());
}

/** Publicar un curso. Solo los tutores: es la regla del muro. */
export async function POST(req: Request) {
  const yo = await usuarioActual(req);
  if (!yo) return sinSesion();

  const usuario = await db.usuarios.findUnique({ where: { id: yo } });
  if (usuario?.rol !== 'tutor') {
    return Response.json({ error: 'Solo los tutores pueden publicar cursos.' }, { status: 403 });
  }

  const { titulo, descripcion, materia, modalidad, cuando, cupos, creditos } = await req.json();
  const curso = await db.cursos.create({
    data: { tutor_id: yo, titulo, descripcion, materia, modalidad, cuando, cupos, creditos },
  });
  return Response.json({ id: curso.id }, { status: 201 });
}
