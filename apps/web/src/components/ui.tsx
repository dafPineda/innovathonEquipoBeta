import Image from 'next/image';
import type { ReactNode } from 'react';

/**
 * Primitivas visuales de Órbita. Sin dependencias externas: clases de Tailwind
 * directamente, para que el diseño se pueda tocar sin pelearse con una librería.
 */

const VARIANTES_BOTON = {
  primario:
    'bg-marca-600 text-white hover:bg-marca-500 disabled:bg-neutral-300 disabled:cursor-not-allowed',
  claro: 'bg-white text-neutral-800 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50',
  fantasma: 'text-neutral-600 hover:bg-neutral-100',
  acento: 'bg-marca-600 text-white hover:bg-marca-500 disabled:bg-marca-200 disabled:cursor-not-allowed',
} as const;

type PropsBoton = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof VARIANTES_BOTON;
  children: ReactNode;
};

export function Boton({ variante = 'primario', className = '', children, ...props }: PropsBoton) {
  return (
    <button
      {...props}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${VARIANTES_BOTON[variante]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Tarjeta({
  children,
  className = '',
  padding = 'p-5',
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200/80 bg-white shadow-sm ${padding} ${className}`}
    >
      {children}
    </div>
  );
}

const TONOS_ETIQUETA = {
  neutro: 'bg-neutral-100 text-neutral-700',
  marca: 'bg-marca-50 text-marca-700',
  acento: 'bg-acento-50 text-acento-700',
  verde: 'bg-emerald-50 text-emerald-700',
  ambar: 'bg-amber-50 text-amber-700',
  rosa: 'bg-rose-50 text-rose-700',
} as const;

export function Etiqueta({
  children,
  tono = 'neutro',
  className = '',
}: {
  children: ReactNode;
  tono?: keyof typeof TONOS_ETIQUETA;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONOS_ETIQUETA[tono]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Avatar({
  iniciales,
  color,
  tam = 'md',
}: {
  iniciales: string;
  color: string;
  tam?: 'sm' | 'md' | 'lg';
}) {
  const tamaños = {
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-10 w-10 text-xs',
    lg: 'h-14 w-14 text-base',
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${color} ${tamaños[tam]}`}
      aria-hidden
    >
      {iniciales}
    </div>
  );
}

export function Estrellas({ valor, sesiones }: { valor: number; sesiones: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
      <span className="text-amber-500" aria-hidden>
        ★
      </span>
      <span className="font-medium text-neutral-800">{valor.toFixed(1)}</span>
      <span>· {sesiones} sesiones</span>
    </span>
  );
}

/** Icono de Órbita: la "Ó" con su órbita (recorte de public/logo-orbita.png). */
export function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return <Image src="/icono-orbita.png" alt="" width={219} height={219} className={className} />;
}

/** Logotipo completo "Órbita", con subtítulo opcional (p. ej. "Panel del tutor"). */
export function Marca({ subtitulo, className = 'h-7 w-auto' }: { subtitulo?: string; className?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/logo-orbita.png" alt="Órbita" width={687} height={215} priority className={className} />
      {subtitulo ? (
        <span className="border-l border-neutral-200 pl-3 text-xs font-medium text-neutral-500">{subtitulo}</span>
      ) : null}
    </div>
  );
}

/** Aviso de demo: deja claro que nada de esto sale de la máquina. */
export function BannerDemo({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-marca-200 bg-marca-50/60 px-3 py-2 text-xs text-marca-900">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-marca-500" />
      {children ?? 'Demostración: datos locales del navegador. Sin IA ni base de datos conectadas.'}
    </div>
  );
}

export function SeccionTitulo({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">{titulo}</h2>
        {descripcion ? <p className="mt-0.5 text-sm text-neutral-500">{descripcion}</p> : null}
      </div>
      {accion}
    </div>
  );
}
