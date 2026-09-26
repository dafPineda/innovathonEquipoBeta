'use client';

import { useEffect, useRef, useState } from 'react';
import { useAlmacenDemo, type SolicitudEnviada } from '@/lib/almacen';
import { TUTOR_POR_ID } from '@/lib/datos-demo';
import { Avatar, Boton } from '@/components/ui';

type Lado = 'estudiante' | 'tutor';

type MensajeSesion = {
  id: string;
  de: Lado;
  texto: string;
  hora: string;
};

/**
 * Chat entre estudiante y tutor que se abre al aceptar una solicitud, para que
 * acuerden día y hora. Vive en localStorage (clave por solicitud), así que lo
 * que escribe uno lo ve el otro en otra pestaña al instante.
 */
export function ChatSesion({ solicitud, yo }: { solicitud: SolicitudEnviada; yo: Lado }) {
  const { valor: mensajes, setValor: setMensajes } = useAlmacenDemo<MensajeSesion[]>(
    `chat-${solicitud.id}`,
    [],
  );
  const [borrador, setBorrador] = useState('');
  const listaRef = useRef<HTMLDivElement>(null);
  const horarios = TUTOR_POR_ID[solicitud.tutorId]?.disponibles ?? [];

  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [mensajes]);

  function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio) return;
    setMensajes((previos) => [
      ...previos,
      {
        id: `${Date.now().toString(36)}-${previos.length}`,
        de: yo,
        texto: limpio,
        hora: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setBorrador('');
  }

  const otro = yo === 'tutor' ? 'el estudiante' : solicitud.tutorNombre.split(' ')[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-neutral-100 px-4 py-3">
        <p className="text-sm font-semibold text-neutral-900">
          {yo === 'tutor' ? 'Estudiante de la demo' : solicitud.tutorNombre} · {solicitud.materia}
        </p>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          Chat con {otro} · pónganse de acuerdo en día y hora
        </p>
      </div>

      <div ref={listaRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {mensajes.length === 0 ? (
          <p className="py-4 text-center text-xs text-neutral-400">
            {yo === 'tutor'
              ? 'Saluda y propón un horario para la sesión.'
              : `${solicitud.tutorNombre.split(' ')[0]} aceptó tu solicitud. Escríbele para acordar la sesión.`}
          </p>
        ) : null}

        {mensajes.map((m) => {
          const mio = m.de === yo;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mio ? 'justify-end' : ''}`}>
              {!mio ? (
                m.de === 'tutor' ? (
                  <Avatar iniciales={solicitud.tutorIniciales} color={solicitud.tutorColor} tam="sm" />
                ) : (
                  <Avatar iniciales="ES" color="from-sky-400 to-blue-500" tam="sm" />
                )
              ) : null}
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  mio
                    ? 'rounded-br-md bg-marca-600 text-white'
                    : 'rounded-bl-md bg-neutral-100 text-neutral-800'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.texto}</p>
                <p className={`mt-0.5 text-[10px] ${mio ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  {m.hora}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Atajos: el tutor propone sus horarios con un clic */}
      {yo === 'tutor' && horarios.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-neutral-100 px-3 pt-2">
          {horarios.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => enviar(`¿Te viene bien ${h}?`)}
              className="cursor-pointer rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-700 transition hover:border-marca-300 hover:bg-marca-50 hover:text-marca-800"
            >
              Proponer {h}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2 p-2">
        <textarea
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviar(borrador);
            }
          }}
          rows={1}
          placeholder="Escribe un mensaje…"
          className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-marca-400 focus:ring-2 focus:ring-marca-100"
        />
        <Boton variante="acento" onClick={() => enviar(borrador)} disabled={!borrador.trim()}>
          Enviar
        </Boton>
      </div>
    </div>
  );
}

/** Clave de la conversación abierta en cada panel, para poder abrirla desde una tarjeta. */
export const claveConversacionActiva = (yo: Lado) => `conversacion-activa-${yo}`;

/**
 * Bandeja de conversaciones: columna con la lista a la izquierda y el chat
 * abierto a la derecha. En el móvil se apilan.
 */
export function Conversaciones({ solicitudes, yo }: { solicitudes: SolicitudEnviada[]; yo: Lado }) {
  const { valor: activa, setValor: setActiva } = useAlmacenDemo<string>(claveConversacionActiva(yo), '');
  if (solicitudes.length === 0) return null;

  const abierta = solicitudes.find((s) => s.id === activa) ?? solicitudes[0]!;

  return (
    <section id="conversaciones" className="scroll-mt-6 space-y-3">
      <h2 className="text-sm font-semibold text-neutral-900">Conversaciones</h2>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm md:h-[30rem] md:flex-row">
        <ul className="max-h-48 shrink-0 overflow-y-auto border-b border-neutral-100 md:max-h-none md:w-64 md:border-b-0 md:border-r">
          {solicitudes.map((s) => (
            <ItemConversacion
              key={s.id}
              solicitud={s}
              yo={yo}
              seleccionada={s.id === abierta.id}
              onAbrir={() => setActiva(s.id)}
            />
          ))}
        </ul>
        <div className="h-[26rem] min-w-0 flex-1 md:h-auto">
          <ChatSesion key={abierta.id} solicitud={abierta} yo={yo} />
        </div>
      </div>
    </section>
  );
}

function ItemConversacion({
  solicitud,
  yo,
  seleccionada,
  onAbrir,
}: {
  solicitud: SolicitudEnviada;
  yo: Lado;
  seleccionada: boolean;
  onAbrir: () => void;
}) {
  const { valor: mensajes } = useAlmacenDemo<MensajeSesion[]>(`chat-${solicitud.id}`, []);
  const ultimo = mensajes[mensajes.length - 1];
  const titulo = yo === 'tutor' ? 'Estudiante de la demo' : solicitud.tutorNombre;

  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        aria-current={seleccionada}
        className={`flex w-full cursor-pointer items-start gap-2.5 px-3 py-3 text-left transition ${
          seleccionada ? 'bg-marca-50' : 'hover:bg-neutral-50'
        }`}
      >
        {yo === 'tutor' ? (
          <Avatar iniciales="ES" color="from-sky-400 to-blue-500" tam="sm" />
        ) : (
          <Avatar iniciales={solicitud.tutorIniciales} color={solicitud.tutorColor} tam="sm" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-neutral-900">{titulo}</p>
            <span className="shrink-0 text-[10px] text-neutral-400">{ultimo?.hora ?? solicitud.creadaEn}</span>
          </div>
          <p className="truncate text-xs text-neutral-500">
            {ultimo ? `${ultimo.de === yo ? 'Tú: ' : ''}${ultimo.texto}` : `${solicitud.materia} · sin mensajes`}
          </p>
        </div>
      </button>
    </li>
  );
}
