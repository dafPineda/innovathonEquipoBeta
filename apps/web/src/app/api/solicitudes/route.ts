import { db } from '@/lib/db';
import { listarSolicitudes, obtenerSolicitud } from '@/lib/consultas';
import { MODO_SIN_AUTH } from '@/lib/modo-demo';
import { sinSesion, usuarioActual } from '@/lib/sesion';

/** Solicitudes del usuario: las que envió (estudiante) y las que recibió (tutor). */
export async function GET(req: Request) {
  const yo = await usuarioActual(req);
  if (!yo) return sinSesion();
  const todas = MODO_SIN_AUTH && new URL(req.url).searchParams.get('todas') === '1';
  return Response.json(await listarSolicitudes(yo, todas));
}

/** El estudiante pide ayuda a un tutor desde el diagnóstico del chat. */
export async function POST(req: Request) {
  const yo = await usuarioActual(req);
  if (!yo) return sinSesion();
  const { tutorId, materia, resumen, origen, creditos } = await req.json();

  const creada = await db.solicitudes.create({
    data: { estudiante_id: yo, tutor_id: tutorId, materia, resumen, origen, creditos },
  });
  return Response.json(await obtenerSolicitud(creada.id), { status: 201 });
}
