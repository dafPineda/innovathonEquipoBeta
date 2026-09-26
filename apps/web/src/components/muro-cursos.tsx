'use client';

import { useState } from 'react';
import { useAlmacenDemo } from '@/lib/almacen';
import { fecha, llamar, useConsulta } from '@/lib/api';
import {
  MATERIAS,
  TUTORES,
  TUTOR_POR_ID,
  type Curso,
  type Materia,
} from '@/lib/datos-demo';
import type { Rol } from '@/lib/rol';
import { Avatar, Boton, Etiqueta, Tarjeta } from '@/components/ui';

/** Quién está mirando el muro. Lo decide el servidor (Clerk o modo demo). */
export type Visitante = {
  id: string;
  nombre: string;
  iniciales: string;
  rol: Rol;
  /** En modo demo el tutor se elige en pantalla (como en su panel). */
  demo: boolean;
};

const COLOR_TUTOR_CLERK = 'from-emerald-400 to-teal-500';

type DatosCurso = Pick<Curso, 'titulo' | 'descripcion' | 'materia' | 'modalidad' | 'cuando' | 'cupos' | 'creditos'>;

/**
 * Muro de cursos: una red social pequeña donde los tutores publican clases y
 * todos pueden verlas, darles "me gusta", comentar e inscribirse.
 *
 * Solo los tutores ven el formulario de publicar: el rol lo decide el servidor
 * con Clerk, y la API vuelve a comprobarlo al guardar. Los datos están en la
 * base (Supabase) y se refrescan solos cada pocos segundos.
 */
export function MuroCursos({ visitante }: { visitante: Visitante }) {
  // En modo demo, el tutor "logueado" es el que se eligió en el panel del tutor.
  const { valor: tutorActivo, setValor: setTutorActivo } = useAlmacenDemo<string>(
    'tutor-activo',
    TUTORES[0]!.id,
  );
  const [filtro, setFiltro] = useState<Materia | 'todas' | 'mios'>('todas');

  const esTutor = visitante.rol === 'tutor';
  const tutorDemo = TUTOR_POR_ID[tutorActivo] ?? TUTORES[0]!;
  const yo =
    esTutor && visitante.demo
      ? { id: tutorDemo.id, nombre: tutorDemo.nombre, iniciales: tutorDemo.iniciales, color: tutorDemo.color }
      : { id: visitante.id, nombre: visitante.nombre, iniciales: visitante.iniciales, color: COLOR_TUTOR_CLERK };

  const { datos: cursos, error, cargando } = useConsulta<Curso[]>('/api/cursos', yo.id, 5000);
  const [fallo, setFallo] = useState<string | null>(null);

  const visibles = (cursos ?? []).filter((c) =>
    filtro === 'todas' ? true : filtro === 'mios' ? c.tutorId === yo.id : c.materia === filtro,
  );

  /** Envuelve cada escritura: si la API falla, se enseña el motivo arriba. */
  async function intentar(accion: () => Promise<unknown>) {
    try {
      setFallo(null);
      await accion();
    } catch (e) {
      setFallo((e as Error).message);
    }
  }

  async function publicar(datos: DatosCurso) {
    if (!esTutor) return; // solo los tutores crean cursos
    await intentar(() => llamar(yo.id, '/api/cursos', 'POST', datos));
    setFiltro('todas');
  }

  const chips: { valor: typeof filtro; texto: string }[] = [
    { valor: 'todas', texto: 'Todo' },
    ...(esTutor ? [{ valor: 'mios' as const, texto: 'Mis cursos' }] : []),
    ...MATERIAS.map((m) => ({ valor: m, texto: m })),
  ];

  return (
    <div className="space-y-5">
      {esTutor ? (
        <>
          {visitante.demo ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <span className="font-medium">Publicas como:</span>
              <select
                value={tutorDemo.id}
                onChange={(e) => setTutorActivo(e.target.value)}
                className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800"
              >
                {TUTORES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <NuevoCurso autor={yo} onPublicar={publicar} />
        </>
      ) : (
        <p className="rounded-xl bg-neutral-100 px-4 py-2.5 text-xs text-neutral-600">
          Solo los tutores pueden publicar cursos. Tú puedes inscribirte, comentar y darles me gusta.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.valor}
            type="button"
            onClick={() => setFiltro(c.valor)}
            aria-pressed={filtro === c.valor}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${
              filtro === c.valor
                ? 'border-marca-400 bg-marca-50 text-marca-800'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
            }`}
          >
            {c.texto}
          </button>
        ))}
      </div>

      {fallo || error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          No se pudo {fallo ? 'guardar' : 'cargar los cursos'}: {fallo ?? error}
        </p>
      ) : null}

      {cargando ? (
        <Tarjeta className="text-center text-sm text-neutral-500">Cargando cursos…</Tarjeta>
      ) : visibles.length === 0 ? (
        <Tarjeta className="text-center text-sm text-neutral-500">
          {filtro === 'mios' ? 'Aún no has publicado ningún curso.' : 'No hay cursos de esta materia todavía.'}
        </Tarjeta>
      ) : (
        visibles.map((curso) => (
          <PublicacionCurso
            key={curso.id}
            curso={curso}
            yo={yo}
            esTutor={esTutor}
            onAccion={(accion, texto) =>
              intentar(() => llamar(yo.id, `/api/cursos/${curso.id}`, 'POST', { accion, texto }))
            }
            onBorrar={() => intentar(() => llamar(yo.id, `/api/cursos/${curso.id}`, 'DELETE'))}
          />
        ))
      )}
    </div>
  );
}

type Autor = { id: string; nombre: string; iniciales: string; color: string };

const CAMPO =
  'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-marca-400 focus:ring-2 focus:ring-marca-100';

function NuevoCurso({
  autor,
  onPublicar,
}: {
  autor: Autor;
  onPublicar: (datos: DatosCurso) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [materia, setMateria] = useState<Materia>(MATERIAS[0]!);
  const [modalidad, setModalidad] = useState<Curso['modalidad']>('En línea');
  const [cuando, setCuando] = useState('');
  const [cupos, setCupos] = useState(10);
  const [creditos, setCreditos] = useState(2);

  const valido = titulo.trim() && descripcion.trim() && cuando.trim() && cupos > 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    await onPublicar({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      materia,
      modalidad,
      cuando: cuando.trim(),
      cupos,
      creditos: Math.max(0, creditos),
    });
    setTitulo('');
    setDescripcion('');
    setCuando('');
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <Tarjeta className="flex items-center gap-3">
        <Avatar iniciales={autor.iniciales} color={autor.color} />
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex-1 cursor-pointer rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-left text-sm text-neutral-500 transition hover:bg-neutral-100"
        >
          ¿Qué clase vas a dar, {autor.nombre.split(' ')[0]}?
        </button>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <form onSubmit={enviar} className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar iniciales={autor.iniciales} color={autor.color} />
          <p className="text-sm font-semibold text-neutral-900">Nuevo curso</p>
        </div>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título: p. ej. Repaso de integrales para el parcial"
          className={CAMPO}
          autoFocus
        />
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="¿Qué van a aprender y qué tienen que traer?"
          rows={3}
          className={`${CAMPO} resize-none`}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-neutral-500">
            Materia
            <select value={materia} onChange={(e) => setMateria(e.target.value as Materia)} className={CAMPO}>
              {MATERIAS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-neutral-500">
            Modalidad
            <select
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value as Curso['modalidad'])}
              className={CAMPO}
            >
              <option>En línea</option>
              <option>Presencial</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-neutral-500">
            Cuándo
            <input
              value={cuando}
              onChange={(e) => setCuando(e.target.value)}
              placeholder="Sábado 10:00"
              className={CAMPO}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-neutral-500">
              Cupos
              <input
                type="number"
                min={1}
                value={cupos}
                onChange={(e) => setCupos(Number(e.target.value))}
                className={CAMPO}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-500">
              Créditos
              <input
                type="number"
                min={0}
                value={creditos}
                onChange={(e) => setCreditos(Number(e.target.value))}
                className={CAMPO}
              />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="acento" disabled={!valido}>
            Publicar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

function PublicacionCurso({
  curso,
  yo,
  esTutor,
  onAccion,
  onBorrar,
}: {
  curso: Curso;
  yo: Autor;
  esTutor: boolean;
  onAccion: (accion: 'inscribir' | 'me-gusta' | 'comentar', texto?: string) => Promise<void>;
  onBorrar: () => void;
}) {
  const [verComentarios, setVerComentarios] = useState(curso.comentarios.length > 0);
  const [comentario, setComentario] = useState('');

  const esMio = curso.tutorId === yo.id;
  const meGusta = curso.meGusta.includes(yo.id);
  const inscrito = curso.inscritos.some((i) => i.id === yo.id);
  const libres = curso.cupos - curso.inscritos.length;

  function alternarMeGusta() {
    void onAccion('me-gusta');
  }

  function alternarInscripcion() {
    if (!inscrito && libres <= 0) return;
    void onAccion('inscribir');
  }

  async function comentar(e: React.FormEvent) {
    e.preventDefault();
    const texto = comentario.trim();
    if (!texto) return;
    setComentario('');
    await onAccion('comentar', texto);
  }

  return (
    <Tarjeta padding="p-0" className="overflow-hidden">
      <div className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <Avatar iniciales={curso.tutorIniciales} color={curso.tutorColor} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900">{curso.tutorNombre}</p>
            <p className="text-xs text-neutral-500">Tutor · {fecha(curso.publicado)}</p>
          </div>
          <Etiqueta tono="marca">{curso.materia}</Etiqueta>
        </div>

        <div>
          <h3 className="text-base font-semibold text-neutral-900">{curso.titulo}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{curso.descripcion}</p>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <span>📅 {curso.cuando}</span>
          <span>{curso.modalidad === 'En línea' ? '💻' : '📍'} {curso.modalidad}</span>
          <span>🎟️ {curso.creditos} créditos</span>
          <span className={libres <= 0 ? 'font-medium text-rose-600' : ''}>
            👥 {curso.inscritos.length}/{curso.cupos} {libres <= 0 ? '· completo' : 'inscritos'}
          </span>
        </div>

        {esMio && curso.inscritos.length > 0 ? (
          <p className="text-xs text-neutral-500">
            <span className="font-medium text-neutral-700">Inscritos: </span>
            {curso.inscritos.map((i) => i.nombre).join(', ')}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-1 border-t border-neutral-100 px-3 py-2">
        <button
          type="button"
          onClick={alternarMeGusta}
          aria-pressed={meGusta}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-100 ${
            meGusta ? 'text-rose-600' : 'text-neutral-600'
          }`}
        >
          {meGusta ? '♥' : '♡'} Me gusta · {curso.meGusta.length}
        </button>
        <button
          type="button"
          onClick={() => setVerComentarios((v) => !v)}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
        >
          💬 Comentarios · {curso.comentarios.length}
        </button>
        <div className="ml-auto">
          {esMio ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('¿Eliminar este curso?')) onBorrar();
              }}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-rose-50 hover:text-rose-700"
            >
              Eliminar
            </button>
          ) : !esTutor ? (
            <button
              type="button"
              disabled={!inscrito && libres <= 0}
              onClick={alternarInscripcion}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed ${
                inscrito
                  ? 'border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50'
                  : 'bg-marca-600 text-white hover:bg-marca-500 disabled:bg-marca-200'
              }`}
            >
              {inscrito ? 'Inscrito ✓' : libres <= 0 ? 'Sin cupos' : 'Inscribirme'}
            </button>
          ) : null}
        </div>
      </div>

      {verComentarios ? (
        <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-4">
          {curso.comentarios.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar iniciales={c.iniciales} color="from-neutral-400 to-neutral-500" tam="sm" />
              <div className="min-w-0 rounded-2xl bg-white px-3 py-2 shadow-sm">
                <p className="text-xs font-semibold text-neutral-900">
                  {c.autor} <span className="font-normal text-neutral-400">· {fecha(c.hora)}</span>
                </p>
                <p className="text-sm text-neutral-700">{c.texto}</p>
              </div>
            </div>
          ))}
          <form onSubmit={comentar} className="flex gap-2">
            <input
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escribe un comentario…"
              className={`${CAMPO} bg-white`}
            />
            <Boton type="submit" variante="claro" disabled={!comentario.trim()}>
              Comentar
            </Boton>
          </form>
        </div>
      ) : null}
    </Tarjeta>
  );
}

/**
 * Cursos en los que está inscrito un estudiante. Los datos llegan de la API
 * (los pide PestanasEstudiante), los mismos que ve el muro de /cursos.
 */
export function MisCursos({
  cursos,
  estudianteId,
  enlaceMuro,
}: {
  cursos: Curso[] | undefined;
  estudianteId: string;
  enlaceMuro: string;
}) {
  const mios = (cursos ?? []).filter((c) => c.inscritos.some((i) => i.id === estudianteId));

  function desinscribir(id: string) {
    if (!window.confirm('¿Cancelar tu inscripción a este curso?')) return;
    // Mismo endpoint que el botón del muro: alterna la inscripción.
    void llamar(estudianteId, `/api/cursos/${id}`, 'POST', { accion: 'inscribir' });
  }

  if (!cursos) {
    return <Tarjeta className="text-center text-sm text-neutral-500">Cargando tus cursos…</Tarjeta>;
  }

  if (mios.length === 0) {
    return (
      <Tarjeta className="py-10 text-center">
        <p className="text-sm font-medium text-neutral-800">Todavía no estás inscrito en ningún curso.</p>
        <p className="mt-1 text-xs text-neutral-500">Los tutores publican clases en el muro de cursos.</p>
        <a
          href={enlaceMuro}
          className="mt-4 inline-flex rounded-lg bg-marca-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-marca-500"
        >
          Explorar cursos
        </a>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          Estás inscrito en <span className="font-semibold text-neutral-900">{mios.length}</span>{' '}
          {mios.length === 1 ? 'curso' : 'cursos'}.
        </p>
        <a href={enlaceMuro} className="text-xs font-medium text-marca-600 hover:text-acento-600">
          Ver más cursos →
        </a>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {mios.map((c) => (
          <Tarjeta key={c.id} className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Avatar iniciales={c.tutorIniciales} color={c.tutorColor} tam="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">{c.titulo}</p>
                <p className="mt-0.5 text-xs text-neutral-500">con {c.tutorNombre}</p>
              </div>
              <Etiqueta tono="marca">{c.materia}</Etiqueta>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              <span>📅 {c.cuando}</span>
              <span>
                {c.modalidad === 'En línea' ? '💻' : '📍'} {c.modalidad}
              </span>
              <span>🎟️ {c.creditos} créditos</span>
            </div>
            <div className="mt-auto flex items-center justify-between">
              <Etiqueta tono="verde">Inscrito</Etiqueta>
              <button
                type="button"
                onClick={() => desinscribir(c.id)}
                className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-rose-50 hover:text-rose-700"
              >
                Cancelar inscripción
              </button>
            </div>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
