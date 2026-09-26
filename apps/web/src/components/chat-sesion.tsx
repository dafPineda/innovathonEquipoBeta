'use client';

import { useEffect, useRef, useState } from 'react';
import { useAlmacenDemo } from '@/lib/almacen';
import { hora, llamar, useConsulta } from '@/lib/api';
import { TUTOR_POR_ID } from '@/lib/datos-demo';
import type { Lado, MensajeSesion, SolicitudEnviada } from '@/lib/tipos';
import { Avatar, Boton } from '@/components/ui';

/**
 * Chat entre estudiante y tutor que se abre al aceptar una solicitud, para que
 * acuerden día y hora. Los mensajes están en la base (tabla mensajes) y se
 * refrescan cada dos segundos, así que lo que escribe uno le llega al otro.
 */
export function ChatSesion({
  solicitud,
  yo,
  usuarioId,
}: {
  solicitud: SolicitudEnviada;
  yo: Lado;
  usuarioId: string;
}) {
  const url = `/api/solicitudes/${solicitud.id}/mensajes`;
  const { datos: mensajes, error } = useConsulta<MensajeSesion[]>(url, usuarioId, 2000);
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);
  const horarios = TUTOR_POR_ID[solicitud.tutorId]?.disponibles ?? [];

  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [mensajes?.length]);

  async function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    setBorrador('');
    try {
      await llamar(usuarioId, url, 'POST', { texto: limpio });
    } catch {
      setBorrador(limpio); // no se perdió: vuelve al cuadro para reintentar
    } finally {
      setEnviando(false);
    }
  }

  const otroNombre = yo === 'tutor' ? solicitud.estudianteNombre : solicitud.tutorNombre;
  const deQuien = (m: MensajeSesion): Lado => (m.autorId === solicitud.tutorId ? 'tutor' : 'estudiante');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-neutral-100 px-4 py-3">
        <p className="text-sm font-semibold text-neutral-900">
          {otroNombre} · {solicitud.materia}
        </p>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          Chat con {otroNombre.split(' ')[0]} · pónganse de acuerdo en día y hora
        </p>
      </div>

      <div ref={listaRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {error ? (
          <p className="py-4 text-center text-xs text-rose-600">No se pudo cargar el chat: {error}</p>
        ) : !mensajes ? (
          <p className="py-4 text-center text-xs text-neutral-400">Cargando mensajes…</p>
        ) : mensajes.length === 0 ? (
          <p className="py-4 text-center text-xs text-neutral-400">
            {yo === 'tutor'
              ? 'Saluda y propón un horario para la sesión.'
              : `${solicitud.tutorNombre.split(' ')[0]} aceptó tu solicitud. Escríbele para acordar la sesión.`}
          </p>
        ) : null}

        {(mensajes ?? []).map((m) => {
          const de = deQuien(m);
          const mio = de === yo;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mio ? 'justify-end' : ''}`}>
              {!mio ? (
                de === 'tutor' ? (
                  <Avatar iniciales={solicitud.tutorIniciales} color={solicitud.tutorColor} tam="sm" />
                ) : (
                  <Avatar iniciales={solicitud.estudianteIniciales} color={solicitud.estudianteColor} tam="sm" />
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
                  {hora(m.enviadoEn)}
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
              void enviar(borrador);
            }
          }}
          rows={1}
          placeholder="Escribe un mensaje…"
          className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-marca-400 focus:ring-2 focus:ring-marca-100"
        />
        <Boton variante="acento" onClick={() => enviar(borrador)} disabled={!borrador.trim() || enviando}>
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
export function Conversaciones({
  solicitudes,
  yo,
  usuarioId,
}: {
  solicitudes: SolicitudEnviada[];
  yo: Lado;
  usuarioId: string;
}) {
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
              usuarioId={usuarioId}
              seleccionada={s.id === abierta.id}
              onAbrir={() => setActiva(s.id)}
            />
          ))}
        </ul>
        <div className="h-[26rem] min-w-0 flex-1 md:h-auto">
          <ChatSesion key={abierta.id} solicitud={abierta} yo={yo} usuarioId={usuarioId} />
        </div>
      </div>
    </section>
  );
}

function ItemConversacion({
  solicitud,
  yo,
  usuarioId,
  seleccionada,
  onAbrir,
}: {
  solicitud: SolicitudEnviada;
  yo: Lado;
  usuarioId: string;
  seleccionada: boolean;
  onAbrir: () => void;
}) {
  const ultimo = solicitud.ultimoMensaje;
  const titulo = yo === 'tutor' ? solicitud.estudianteNombre : solicitud.tutorNombre;

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
          <Avatar iniciales={solicitud.estudianteIniciales} color={solicitud.estudianteColor} tam="sm" />
        ) : (
          <Avatar iniciales={solicitud.tutorIniciales} color={solicitud.tutorColor} tam="sm" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-neutral-900">{titulo}</p>
            <span className="shrink-0 text-[10px] text-neutral-400">
              {hora(ultimo?.enviadoEn ?? solicitud.creadaEn)}
            </span>
          </div>
          <p className="truncate text-xs text-neutral-500">
            {ultimo
              ? `${ultimo.autorId === usuarioId ? 'Tú: ' : ''}${ultimo.texto}`
              : `${solicitud.materia} · sin mensajes`}
          </p>
        </div>
      </button>
    </li>
  );
}
