import { db } from './db';
import type { Curso } from './datos-demo';
import type { EstadoSolicitud, SolicitudEnviada } from './tipos';

/**
 * Consultas a la base y su traducción a las formas que usa la interfaz.
 * Las usan los endpoints de src/app/api.
 */

const SIN_COLOR = 'from-neutral-400 to-neutral-500';

const conSolicitud = {
  estudiante: true,
  tutor: true,
  mensajes: { orderBy: { enviado_en: 'desc' as const }, take: 1 },
};

type FilaSolicitud = NonNullable<
  Awaited<ReturnType<typeof db.solicitudes.findFirst<{ include: typeof conSolicitud }>>>
>;

function aSolicitud(s: FilaSolicitud): SolicitudEnviada {
  const ultimo = s.mensajes[0];
  return {
    id: s.id,
    estudianteId: s.estudiante_id ?? '',
    estudianteNombre: s.estudiante?.nombre ?? 'Estudiante',
    estudianteIniciales: s.estudiante?.iniciales ?? 'ES',
    estudianteColor: s.estudiante?.color ?? SIN_COLOR,
    tutorId: s.tutor_id ?? '',
    tutorNombre: s.tutor?.nombre ?? 'Tutor',
    tutorIniciales: s.tutor?.iniciales ?? 'TU',
    tutorColor: s.tutor?.color ?? SIN_COLOR,
    origen: s.origen,
    materia: s.materia ?? '',
    resumen: s.resumen ?? '',
    creditos: s.creditos ?? 0,
    estado: (s.estado ?? 'enviada') as EstadoSolicitud,
    creadaEn: (s.creada_en ?? new Date()).toISOString(),
    ultimoMensaje: ultimo
      ? {
          autorId: ultimo.autor_id ?? '',
          texto: ultimo.texto ?? '',
          enviadoEn: (ultimo.enviado_en ?? new Date()).toISOString(),
        }
      : null,
  };
}

/** Las del usuario (enviadas o recibidas). `todas` solo en modo demo: contadores del selector. */
export async function listarSolicitudes(usuarioId: string, todas = false) {
  const filas = await db.solicitudes.findMany({
    where: todas ? {} : { OR: [{ estudiante_id: usuarioId }, { tutor_id: usuarioId }] },
    include: conSolicitud,
    orderBy: { creada_en: 'asc' },
  });
  return filas.map(aSolicitud);
}

export async function obtenerSolicitud(id: string) {
  const fila = await db.solicitudes.findUnique({ where: { id }, include: conSolicitud });
  return fila ? aSolicitud(fila) : null;
}

const conCurso = {
  tutor: true,
  inscripciones: { include: { estudiante: true }, orderBy: { inscrito_en: 'asc' as const } },
  me_gusta: true,
  comentarios: { include: { autor: true }, orderBy: { creado_en: 'asc' as const } },
};

export async function listarCursos(): Promise<Curso[]> {
  const filas = await db.cursos.findMany({ include: conCurso, orderBy: { publicado_en: 'desc' } });
  return filas.map((c) => ({
    id: c.id,
    tutorId: c.tutor_id ?? '',
    tutorNombre: c.tutor?.nombre ?? 'Tutor',
    tutorIniciales: c.tutor?.iniciales ?? 'TU',
    tutorColor: c.tutor?.color ?? SIN_COLOR,
    titulo: c.titulo ?? '',
    descripcion: c.descripcion ?? '',
    materia: (c.materia ?? 'Matemáticas') as Curso['materia'],
    modalidad: (c.modalidad ?? 'En línea') as Curso['modalidad'],
    cuando: c.cuando ?? '',
    cupos: c.cupos ?? 0,
    creditos: c.creditos ?? 0,
    publicado: (c.publicado_en ?? new Date()).toISOString(),
    meGusta: c.me_gusta.map((m) => m.usuario_id),
    inscritos: c.inscripciones.map((i) => ({ id: i.estudiante_id, nombre: i.estudiante.nombre })),
    comentarios: c.comentarios.map((k) => ({
      id: k.id,
      autor: k.autor?.nombre ?? 'Anónimo',
      iniciales: k.autor?.iniciales ?? '··',
      texto: k.texto ?? '',
      hora: (k.creado_en ?? new Date()).toISOString(),
    })),
  }));
}
