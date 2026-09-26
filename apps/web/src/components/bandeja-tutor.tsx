'use client';

import { SOLICITUDES_DEMO, type SolicitudDemo, type Tutor } from '@/lib/datos-demo';
import { useAlmacenDemo, type SolicitudEnviada } from '@/lib/almacen';
import { Avatar, Boton, Etiqueta, SeccionTitulo, Tarjeta } from '@/components/ui';
import { claveConversacionActiva, Conversaciones } from '@/components/chat-sesion';

type Decision = 'aceptada' | 'descartada';

const TONO_URGENCIA = {
  alta: 'rosa',
  media: 'ambar',
  baja: 'neutro',
} as const;

const ETIQUETA_URGENCIA = { alta: 'urgente', media: 'esta semana', baja: 'sin urgencia' } as const;

export function BandejaTutor({ tutor }: { tutor?: Tutor }) {
  // Solicitudes fijas de la demo: aceptar o descartar.
  // Cada tutor tiene sus propias decisiones, así que puedes ensayar los dos
  // lados sin que una aceptación estropee el ensayo del otro.
  const { valor: decisiones, setValor: setDecisiones } = useAlmacenDemo<Record<string, Decision>>(
    tutor ? `decisiones-${tutor.id}` : 'decisiones-genericas',
    {},
  );

  // Solicitudes que un estudiante envió en este mismo navegador (otra pestaña).
  // Al aceptar una, el estudiante ve el cambio al instante.
  const { valor: todas, setValor: setTodas } = useAlmacenDemo<SolicitudEnviada[]>('solicitudes', []);
  // Cada tutor ve solo las que le enviaron a él; las más nuevas arriba.
  const recibidas = (tutor ? todas.filter((s) => s.tutorId === tutor.id) : todas).slice().reverse();
  const sinResponder = recibidas.filter((s) => s.estado === 'enviada').length;
  const conChat = recibidas.filter((s) => s.estado === 'aceptada');
  const { setValor: setConversacion } = useAlmacenDemo<string>(claveConversacionActiva('tutor'), '');

  function abrirChat(id: string) {
    setConversacion(id);
    document.getElementById('conversaciones')?.scrollIntoView({ behavior: 'smooth' });
  }

  // Con tutor, cada uno solo ve lo que le corresponde por materia. Sin tutor
  // (sesión real de Clerk) se muestran todas: aún no hay perfil en la base.
  const suyas = tutor ? SOLICITUDES_DEMO.filter((s) => tutor.materias.includes(s.materia)) : SOLICITUDES_DEMO;
  const pendientes = suyas.filter((s) => !decisiones[s.id]);
  const aceptadas = suyas.filter((s) => decisiones[s.id] === 'aceptada');
  const descartadas = suyas.filter((s) => decisiones[s.id] === 'descartada');

  function aceptar(id: string) {
    setTodas((actuales) => actuales.map((s) => (s.id === id ? { ...s, estado: 'aceptada' } : s)));
    abrirChat(id);
  }

  return (
    <div className="space-y-8">
      {recibidas.length > 0 ? (
        <section className="space-y-3">
          <SeccionTitulo
            titulo="Solicitudes entrantes"
            descripcion={
              tutor
                ? `Enviadas a ${tutor.nombre} por un estudiante en este navegador durante la demo.`
                : 'Enviadas por un estudiante en este navegador durante la demo.'
            }
            accion={<Etiqueta tono="acento">{sinResponder} sin responder</Etiqueta>}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {recibidas.map((s) => (
              <Tarjeta key={s.id} className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Avatar iniciales={s.tutorIniciales} color={s.tutorColor} tam="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">Estudiante de la demo</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Para {s.tutorNombre} · {s.materia}
                    </p>
                  </div>
                  <Etiqueta tono="acento">{s.creditos} créditos</Etiqueta>
                </div>
                <p className="line-clamp-2 text-sm text-neutral-600">{s.resumen}</p>
                {s.estado === 'aceptada' ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-800">
                    Aceptada · sesión por confirmar
                    <button
                      type="button"
                      onClick={() => abrirChat(s.id)}
                      className="cursor-pointer font-semibold text-emerald-900 hover:underline"
                    >
                      Abrir chat →
                    </button>
                  </div>
                ) : (
                  <Boton variante="acento" onClick={() => aceptar(s.id)}>
                    Aceptar solicitud
                  </Boton>
                )}
              </Tarjeta>
            ))}
          </div>
        </section>
      ) : null}

      <Conversaciones solicitudes={conChat} yo="tutor" />

      <section className="space-y-3">
        <SeccionTitulo
          titulo="Solicitudes disponibles"
          descripcion={
            tutor
              ? `Lo que le encaja a ${tutor.nombre}: ${tutor.materias.join(', ')}.`
              : 'Las más recientes primero. Acepta una o déjala pasar.'
          }
          accion={<Etiqueta tono="marca">{pendientes.length} sin revisar</Etiqueta>}
        />

        {pendientes.length === 0 ? (
          <Tarjeta className="text-center">
            {tutor ? (
              <>
                <p className="text-sm text-neutral-600">
                  Ahora mismo no hay solicitudes de {tutor.materias.join(' o ')}.
                </p>
                <p className="mt-1 text-xs text-neutral-400">Cambia de tutor arriba para ver las suyas.</p>
              </>
            ) : (
              <p className="text-sm text-neutral-600">No queda ninguna solicitud sin revisar.</p>
            )}
          </Tarjeta>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pendientes.map((s) => (
              <TarjetaSolicitud
                key={s.id}
                solicitud={s}
                onDecidir={(decision) => setDecisiones({ ...decisiones, [s.id]: decision })}
              />
            ))}
          </div>
        )}
      </section>

      {aceptadas.length > 0 ? (
        <section className="space-y-3">
          <SeccionTitulo titulo="Aceptadas" descripcion="Sesiones que vas a tomar." />
          <div className="grid gap-4 lg:grid-cols-2">
            {aceptadas.map((s) => (
              <TarjetaSolicitud
                key={s.id}
                solicitud={s}
                estado="aceptada"
                onDecidir={(decision) => setDecisiones({ ...decisiones, [s.id]: decision })}
              />
            ))}
          </div>
        </section>
      ) : null}

      {descartadas.length > 0 ? (
        <details className="text-sm text-neutral-500">
          <summary className="cursor-pointer">{descartadas.length} descartada(s) · ver</summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {descartadas.map((s) => (
              <TarjetaSolicitud
                key={s.id}
                solicitud={s}
                estado="descartada"
                onDecidir={(decision) => setDecisiones({ ...decisiones, [s.id]: decision })}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TarjetaSolicitud({
  solicitud,
  estado,
  onDecidir,
}: {
  solicitud: SolicitudDemo;
  estado?: Decision;
  onDecidir: (decision: Decision) => void;
}) {
  const { estudiante, iniciales, color, materia, titulo, descripcion, urgencia, creditos, hace } = solicitud;

  return (
    <Tarjeta className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Avatar iniciales={iniciales} color={color} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-900">{estudiante}</p>
            <Etiqueta tono={TONO_URGENCIA[urgencia]}>{ETIQUETA_URGENCIA[urgencia]}</Etiqueta>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            {materia} · {hace}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-neutral-500">ofrece</p>
          <p className="text-sm font-semibold text-marca-600">{creditos} cr</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-900">{titulo}</p>
        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-neutral-600">{descripcion}</p>
      </div>

      {estado ? (
        <div
          className={`mt-auto rounded-xl px-3 py-2.5 text-xs font-medium ${
            estado === 'aceptada' ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          {estado === 'aceptada' ? 'Aceptada · sesión por confirmar' : 'Descartada'}
        </div>
      ) : (
        <div className="mt-auto flex gap-2">
          <Boton variante="acento" className="flex-1" onClick={() => onDecidir('aceptada')}>
            Aceptar
          </Boton>
          <Boton variante="claro" onClick={() => onDecidir('descartada')}>
            Descartar
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}
