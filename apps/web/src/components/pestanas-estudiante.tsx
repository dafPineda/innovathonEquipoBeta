'use client';

import { useState } from 'react';
import { useAlmacenDemo } from '@/lib/almacen';
import { CURSOS_DEMO, type Curso } from '@/lib/datos-demo';
import { ChatAsistente } from '@/components/chat-asistente';
import { MisCursos } from '@/components/muro-cursos';

type Pestana = 'asistente' | 'cursos';

/**
 * Pestañas del panel del estudiante. Las dos quedan montadas y solo se oculta
 * la inactiva: así la conversación con el asistente no se pierde al cambiar.
 */
export function PestanasEstudiante({
  estudianteId,
  enlaceMuro,
  inicial = 'asistente',
}: {
  estudianteId: string;
  enlaceMuro: string;
  inicial?: Pestana;
}) {
  const [activa, setActiva] = useState<Pestana>(inicial);
  const { valor: cursos } = useAlmacenDemo<Curso[]>('cursos', CURSOS_DEMO);
  const inscritos = cursos.filter((c) => c.inscritos.some((i) => i.id === estudianteId)).length;

  const pestanas: { id: Pestana; texto: string; cuenta?: number }[] = [
    { id: 'asistente', texto: 'Asistente' },
    { id: 'cursos', texto: 'Mis cursos', cuenta: inscritos },
  ];

  return (
    <div className="space-y-6">
      <div role="tablist" className="flex gap-1 border-b border-neutral-200">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={activa === p.id}
            onClick={() => setActiva(p.id)}
            className={`-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              activa === p.id
                ? 'border-acento-500 text-marca-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {p.texto}
            {p.cuenta ? (
              <span className="rounded-full bg-acento-50 px-1.5 text-[11px] font-semibold text-acento-700">
                {p.cuenta}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" hidden={activa !== 'asistente'}>
        <ChatAsistente />
      </div>
      <div role="tabpanel" hidden={activa !== 'cursos'}>
        <MisCursos estudianteId={estudianteId} enlaceMuro={enlaceMuro} />
      </div>
    </div>
  );
}
