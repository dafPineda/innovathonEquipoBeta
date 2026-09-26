'use client';

import { useEffect, useState } from 'react';

/**
 * Cliente de la API (/api/*) para los componentes.
 *
 * - `llamar` hace la petición. En modo demo manda `x-usuario` para decir quién
 *   es (con Clerk el servidor usa la sesión y la ignora).
 * - `useConsulta` lee y se refresca sola cada pocos segundos, así lo que hace
 *   el otro lado (el tutor acepta, llega un mensaje) aparece sin recargar.
 *   Tras cualquier escritura se avisa a todas las consultas para que recarguen
 *   al momento, sin esperar al siguiente ciclo.
 */

const EVENTO = 'orbita:datos-cambiaron';

export async function llamar<T = unknown>(
  usuarioId: string,
  url: string,
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  cuerpo?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-usuario': usuarioId },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    cache: 'no-store',
  });
  if (!res.ok) {
    const detalle = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detalle?.error ?? `Error ${res.status}`);
  }
  if (metodo !== 'GET') window.dispatchEvent(new Event(EVENTO));
  return (await res.json()) as T;
}

export function useConsulta<T>(url: string, usuarioId: string, cadaMs = 4000) {
  // Guardamos a qué consulta pertenece cada respuesta: al cambiar de tutor no
  // se muestran ni un instante los datos del anterior.
  const clave = `${usuarioId}|${url}`;
  const [estado, setEstado] = useState<{ clave: string; datos?: T; error?: string }>({ clave });

  useEffect(() => {
    let vivo = true;
    const cargar = () => {
      llamar<T>(usuarioId, url)
        .then((datos) => vivo && setEstado({ clave, datos }))
        .catch((e: Error) => vivo && setEstado((previo) => ({ ...previo, clave, error: e.message })));
    };
    cargar();
    const intervalo = window.setInterval(cargar, cadaMs);
    window.addEventListener(EVENTO, cargar);
    return () => {
      vivo = false;
      window.clearInterval(intervalo);
      window.removeEventListener(EVENTO, cargar);
    };
  }, [clave, url, usuarioId, cadaMs]);

  const actual = estado.clave === clave ? estado : { datos: undefined, error: undefined };
  return { datos: actual.datos, error: actual.error, cargando: actual.datos === undefined && !actual.error };
}

/** "16:23" en la hora local del navegador. */
export function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

/** "26 sept, 16:23" en la hora local del navegador. */
export function fecha(iso: string) {
  return new Date(iso).toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
