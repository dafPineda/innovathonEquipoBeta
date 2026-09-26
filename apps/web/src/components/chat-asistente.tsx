'use client';

import { useEffect, useRef, useState } from 'react';
import {
  analizarMensaje,
  construirDiagnostico,
  respuestaDelAsistente,
  SUGERENCIAS,
  TUTOR_POR_ID,
  type Diagnostico,
} from '@/lib/datos-demo';
import { nuevaSolicitud, useAlmacenDemo, type SolicitudEnviada } from '@/lib/almacen';
import { Avatar, Boton, Etiqueta, Estrellas, Logo, Tarjeta } from '@/components/ui';

type Mensaje = {
  id: string;
  de: 'yo' | 'orbita';
  texto: string;
  diagnostico?: Diagnostico;
};

let contador = 0;
function nuevoId() {
  contador += 1;
  return `m${contador}-${Date.now().toString(36)}`;
}

/** Cuántos mensajes necesita el asistente antes de diagnosticar. */
const MENSAJES_PARA_DIAGNOSTICAR = 3;

export function ChatAsistente() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [turno, setTurno] = useState(0);
  const [borrador, setBorrador] = useState('');
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const temporizadores = useRef<number[]>([]);
  const { valor: solicitudes, setValor: setSolicitudes } = useAlmacenDemo<SolicitudEnviada[]>(
    'solicitudes',
    [],
  );

  useEffect(() => {
    const ids = temporizadores.current;
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes, pensando]);

  function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || pensando) return;

    const perfil = analizarMensaje(limpio);
    const numero = turno + 1;

    setMensajes((previos) => [...previos, { id: nuevoId(), de: 'yo', texto: limpio }]);
    setTurno(numero);
    setBorrador('');
    setPensando(true);

    // Sin IA: solo espera, para que se vea el ritmo de una respuesta real.
    const espera = numero >= MENSAJES_PARA_DIAGNOSTICAR ? 1500 : 850;
    const id = window.setTimeout(() => {
      setMensajes((previos) => [
        ...previos,
        {
          id: nuevoId(),
          de: 'orbita',
          texto: respuestaDelAsistente(perfil, numero),
          ...(numero >= MENSAJES_PARA_DIAGNOSTICAR
            ? { diagnostico: construirDiagnostico(perfil, limpio) }
            : {}),
        },
      ]);
      setPensando(false);
    }, espera);
    temporizadores.current.push(id);
  }

  function pedirAyuda(tutorId: string) {
    const tutor = TUTOR_POR_ID[tutorId];
    if (!tutor || solicitudes.some((s) => s.tutorId === tutorId)) return;

    const ultimo = [...mensajes].reverse().find((m) => m.de === 'yo');
    setSolicitudes([
      ...solicitudes,
      nuevaSolicitud({
        tutorId: tutor.id,
        tutorNombre: tutor.nombre,
        tutorIniciales: tutor.iniciales,
        tutorColor: tutor.color,
        materia: tutor.materias[0] ?? 'General',
        resumen: ultimo?.texto ?? 'Sin detalle',
        creditos: tutor.creditosPorHora,
      }),
    ]);
  }

  return (
    <div className="space-y-6">
      <Tarjeta padding="p-0" className="overflow-hidden">
        {/* Cabecera del chat */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
              <Logo className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Asistente Orbita</p>
              <p className="text-xs text-neutral-500">
                {pensando ? 'Escribiendo…' : 'Cuéntame qué te bloquea'}
              </p>
            </div>
          </div>
          <Etiqueta tono="indigo">simulado</Etiqueta>
        </div>

        {/* Mensajes */}
        <div className="h-[26rem] space-y-4 overflow-y-auto px-5 py-5">
          {mensajes.length === 0 ? (
            <div className="flex h-full flex-col justify-center text-center">
              <p className="text-sm font-medium text-neutral-800">
                ¿Con qué te puedo ayudar hoy?
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Con tres mensajes te digo qué te pasa y te propongo a quién pedirle ayuda.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => enviar(s)}
                    className="cursor-pointer rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {mensajes.map((m) => (
            <Burbuja key={m.id} mensaje={m} enviados={solicitudes} onPedir={pedirAyuda} />
          ))}

          {pensando ? (
            <div className="flex items-end gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white">
                OR
              </div>
              <div className="flex gap-1 rounded-2xl rounded-bl-md bg-neutral-100 px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div ref={finRef} />
        </div>

        {/* Redactor */}
        <div className="border-t border-neutral-100 p-3">
          <div className="flex items-end gap-2">
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
              placeholder="Escribe tu problema…"
              className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-neutral-200 px-3.5 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <Boton variante="acento" onClick={() => enviar(borrador)} disabled={!borrador.trim()}>
              Enviar
            </Boton>
          </div>
          <p className="mt-2 px-1 text-[11px] text-neutral-400">
            Enter para enviar · Mayús + Enter para una línea nueva
          </p>
        </div>
      </Tarjeta>

      {/* Solicitudes enviadas en esta demo */}
      {solicitudes.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">Tus solicitudes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {solicitudes.map((s) => (
              <Tarjeta key={s.id} className="flex items-start gap-3">
                <Avatar iniciales={s.tutorIniciales} color={s.tutorColor} tam="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{s.tutorNombre}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{s.resumen}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Etiqueta tono={s.estado === 'aceptada' ? 'verde' : 'ambar'}>
                      {s.estado === 'aceptada' ? 'Aceptada' : 'Esperando respuesta'}
                    </Etiqueta>
                    <span className="text-[11px] text-neutral-400">{s.creadaEn}</span>
                  </div>
                </div>
              </Tarjeta>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Burbuja({
  mensaje,
  enviados,
  onPedir,
}: {
  mensaje: Mensaje;
  enviados: SolicitudEnviada[];
  onPedir: (tutorId: string) => void;
}) {
  const mio = mensaje.de === 'yo';

  return (
    <div className={`flex items-end gap-2 ${mio ? 'justify-end' : ''}`}>
      {!mio ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white">
          OR
        </div>
      ) : null}

      <div className={`max-w-[85%] ${mio ? 'items-end' : ''}`}>
        <div
          className={
            mio
              ? 'rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-sm text-white'
              : 'rounded-2xl rounded-bl-md bg-neutral-100 px-4 py-2.5 text-sm text-neutral-800'
          }
        >
          {mensaje.texto}
        </div>

        {mensaje.diagnostico ? (
          <TarjetaDiagnostico
            diagnostico={mensaje.diagnostico}
            enviados={enviados}
            onPedir={onPedir}
          />
        ) : null}
      </div>
    </div>
  );
}

function TarjetaDiagnostico({
  diagnostico,
  enviados,
  onPedir,
}: {
  diagnostico: Diagnostico;
  enviados: SolicitudEnviada[];
  onPedir: (tutorId: string) => void;
}) {
  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
          Diagnóstico
        </p>
        <Etiqueta tono="indigo">{diagnostico.materia}</Etiqueta>
      </div>

      <p className="text-sm leading-relaxed text-neutral-700">{diagnostico.resumen}</p>

      <ul className="flex flex-wrap gap-1.5">
        {diagnostico.temas.map((t) => (
          <li key={t}>
            <Etiqueta>{t}</Etiqueta>
          </li>
        ))}
      </ul>

      <p className="text-sm text-neutral-700">
        <span className="font-medium text-neutral-900">Buscamos a alguien que: </span>
        {diagnostico.recomendacion}
      </p>

      <div className="space-y-2 pt-1">
        {diagnostico.tutores.map((t) => {
          const tutor = TUTOR_POR_ID[t.id];
          if (!tutor) return null;
          const yaEnviada = enviados.some((s) => s.tutorId === t.id);
          return (
            <Tarjeta key={t.id} className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar iniciales={tutor.iniciales} color={tutor.color} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-semibold text-neutral-900">{tutor.nombre}</p>
                    {tutor.enLinea ? <Etiqueta tono="verde">en línea</Etiqueta> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{tutor.titulo}</p>
                  <div className="mt-1.5">
                    <Estrellas valor={tutor.calificacion} sesiones={tutor.sesiones} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500">Afinidad</p>
                  <p className="text-lg font-semibold text-indigo-600">{t.afinidad}%</p>
                </div>
              </div>

              {/* Barra de afinidad */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                  style={{ width: `${t.afinidad}%` }}
                />
              </div>

              <p className="text-xs leading-relaxed text-neutral-600">{t.motivo}</p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                <span>
                  {tutor.creditosPorHora} créditos por hora
                </span>
                <span>·</span>
                <span>responde en {tutor.respuesta}</span>
                <span>·</span>
                <span>{tutor.disponibles[0]}</span>
              </div>

              <Boton
                variante={yaEnviada ? 'claro' : 'acento'}
                disabled={yaEnviada}
                onClick={() => onPedir(t.id)}
                className="w-full"
              >
                {yaEnviada ? 'Solicitud enviada' : 'Solicitar ayuda'}
              </Boton>
            </Tarjeta>
          );
        })}
      </div>
    </div>
  );
}
