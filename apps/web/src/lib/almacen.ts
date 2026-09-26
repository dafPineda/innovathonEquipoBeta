'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * Estado que vive en el navegador. Es la "base de datos" de la demo.
 *
 * Por qué `useSyncExternalStore` y no `useState` + `useEffect`:
 * leer `localStorage` necesita el navegador, pero el servidor no lo tiene.
 * Este hook resuelve las dos cosas sin adornos: durante la hidratación devuelve
 * el valor inicial (como el servidor), y justo después se suscribe y ya lee lo
 * que había guardado. Además sincroniza entre pestañas con el evento `storage`.
 *
 * Regla de la casa: los secretos y los datos de la demo en el navegador, nada de
 * peticiones. Cuando esto se conecte a Bedrock y a RDS, este archivo se borra.
 */

const PREFIJO = 'orbita:demo:';
const EVENTO = 'orbita:demo:cambio';

/**
 * Caché de lo parseado. `useSyncExternalStore` exige que getSnapshot devuelva
 * siempre la misma referencia mientras el dato no cambie, así que guardamos el
 * texto crudo junto al objeto para no reparsear (y no crear un objeto nuevo) en
 * cada llamada.
 */
const cache = new Map<string, { raw: string | null; valor: unknown }>();

function leer<T>(completa: string, inicial: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(completa);
  } catch {
    return inicial; // localStorage bloqueado (modo privado): seguimos en memoria
  }

  const guardado = cache.get(completa);
  if (guardado && guardado.raw === raw) return guardado.valor as T;

  let valor = inicial;
  if (raw) {
    try {
      valor = JSON.parse(raw) as T;
    } catch {
      valor = inicial; // dato corrupto: mejor empezar limpio que romper la demo
    }
  }
  cache.set(completa, { raw, valor });
  return valor;
}

function suscribir(completa: string, avisar: () => void): () => void {
  const alCambiarEnOtraPestana = (evento: StorageEvent) => {
    if (evento.key === completa) avisar();
  };
  const alCambiarEnEstaPestana = (evento: Event) => {
    if ((evento as CustomEvent<string>).detail === completa) avisar();
  };

  window.addEventListener('storage', alCambiarEnOtraPestana);
  window.addEventListener(EVENTO, alCambiarEnEstaPestana);

  return () => {
    window.removeEventListener('storage', alCambiarEnOtraPestana);
    window.removeEventListener(EVENTO, alCambiarEnEstaPestana);
  };
}

export function useAlmacenDemo<T>(clave: string, inicial: T) {
  const completa = PREFIJO + clave;
  // useRef congela la referencia del valor inicial: durante la hidratación
  // getServerSnapshot debe devolver siempre el mismo objeto.
  const inicialRef = useRef(inicial);

  const valor = useSyncExternalStore(
    useCallback((avisar: () => void) => suscribir(completa, avisar), [completa]),
    useCallback(() => leer(completa, inicialRef.current), [completa]),
    useCallback(() => inicialRef.current, []),
  );

  const escribir = useCallback(
    (siguiente: T | ((actual: T) => T)) => {
      const actual = leer(completa, inicialRef.current);
      const nuevo =
        typeof siguiente === 'function' ? (siguiente as (previo: T) => T)(actual) : siguiente;

      try {
        window.localStorage.setItem(completa, JSON.stringify(nuevo));
      } catch {
        // sin persistencia, pero la demo sigue funcionando en memoria
      }
      cache.delete(completa);
      window.dispatchEvent(new CustomEvent(EVENTO, { detail: completa }));
    },
    [completa],
  );

  const reiniciar = useCallback(() => {
    try {
      window.localStorage.removeItem(completa);
    } catch {
      // sin efecto
    }
    cache.delete(completa);
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: completa }));
  }, [completa]);

  return { valor, setValor: escribir, reiniciar } as const;
}

export type SolicitudEnviada = {
  id: string;
  tutorId: string;
  tutorNombre: string;
  tutorIniciales: string;
  tutorColor: string;
  materia: string;
  resumen: string;
  /** Créditos estimados: una hora con ese tutor. */
  creditos: number;
  estado: 'enviada' | 'aceptada';
  creadaEn: string;
};

export function nuevaSolicitud(
  datos: Omit<SolicitudEnviada, 'id' | 'estado' | 'creadaEn'>,
): SolicitudEnviada {
  return {
    ...datos,
    id: `local-${Date.now().toString(36)}`,
    estado: 'enviada',
    creadaEn: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
  };
}
