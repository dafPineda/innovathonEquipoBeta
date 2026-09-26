'use client';

import { useAlmacenDemo } from '@/lib/almacen';
import { TUTORES, TUTOR_POR_ID, type Tutor } from '@/lib/datos-demo';
import { BandejaTutor } from '@/components/bandeja-tutor';
import { Avatar, Etiqueta, Estrellas } from '@/components/ui';

/**
 * Cuadro de mando del tutor en modo demostración: eliges en qué tutor te
 * metes y ves su perfil y las solicitudes de su materia.
 *
 * Es una herramienta de ensayo, no una función del producto: para alternar
 * entre varias cuentas reales make falta el botón de "ver como", no esto.
 */
export function PapelTutor() {
  const { valor: activo, setValor } = useAlmacenDemo<string>('tutor-activo', TUTORES[0]!.id);
  const tutor = TUTOR_POR_ID[activo] ?? TUTORES[0]!;

  return (
    <div className="space-y-6">
      <SelectorTutor activo={tutor.id} onCambiar={setValor} />
      <PerfilTutor tutor={tutor} />
      <BandejaTutor tutor={tutor} />
    </div>
  );
}

function SelectorTutor({ activo, onCambiar }: { activo: string; onCambiar: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium text-neutral-500">Tutor en pantalla:</span>
      {TUTORES.map((t) => {
        const seleccionado = t.id === activo;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onCambiar(t.id)}
            aria-pressed={seleccionado}
            className={`flex cursor-pointer items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-medium transition ${
              seleccionado
                ? 'border-indigo-400 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-100'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            <Avatar iniciales={t.iniciales} color={t.color} tam="sm" />
            {t.nombre.split(' ')[0]}
          </button>
        );
      })}
    </div>
  );
}

function PerfilTutor({ tutor }: { tutor: Tutor }) {
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <Avatar iniciales={tutor.iniciales} color={tutor.color} tam="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">{tutor.nombre}</h1>
          {tutor.enLinea ? <Etiqueta tono="verde">en línea</Etiqueta> : <Etiqueta>ausente</Etiqueta>}
          <Etiqueta tono="indigo">{tutor.creditosPorHora} créditos por hora</Etiqueta>
        </div>

        <p className="mt-1 text-sm text-neutral-600">{tutor.titulo}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Estrellas valor={tutor.calificacion} sesiones={tutor.sesiones} />
          <span className="text-xs text-neutral-400">·</span>
          <span className="text-xs text-neutral-500">responde en {tutor.respuesta}</span>
        </div>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {tutor.materias.map((m) => (
            <li key={m}>
              <Etiqueta tono="neutro">{m}</Etiqueta>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs text-neutral-500">
          <span className="font-medium text-neutral-700">Disponible: </span>
          {tutor.disponibles.join(' · ')}
        </p>
      </div>
    </div>
  );
}
