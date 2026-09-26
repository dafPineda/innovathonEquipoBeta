import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { exigirRol } from '@/lib/rol';
import { idDemo, MODO_SIN_AUTH, PERSONAJES } from '@/lib/modo-demo';
import { PestanasEstudiante } from '@/components/pestanas-estudiante';
import { BotonCambiarRol } from '@/components/cambiar-rol';
import { BannerDemo, Marca } from '@/components/ui';

export default async function PanelEstudiante({
  searchParams,
}: {
  searchParams: Promise<{ pestana?: string }>;
}) {
  await exigirRol('estudiante');

  const user = MODO_SIN_AUTH ? null : await currentUser();
  const nombre = user?.firstName ?? user?.username ?? PERSONAJES.estudiante.nombre;
  // El mismo id que usa /cursos para las inscripciones.
  const estudianteId = user?.id ?? idDemo('estudiante');
  const enlaceMuro = MODO_SIN_AUTH ? '/cursos?como=estudiante' : '/cursos';
  const pestana = (await searchParams).pestana === 'cursos' ? 'cursos' : 'asistente';

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-marca-50/40">
      <header className="border-b border-neutral-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3.5">
          <Marca subtitulo="Panel del estudiante" />
          <div className="flex items-center gap-3">
            <Link
              href={enlaceMuro}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              Cursos
            </Link>
            <BotonCambiarRol actual="estudiante" />
            <span className="hidden text-sm text-neutral-600 sm:inline">{nombre}</span>
            {MODO_SIN_AUTH ? null : <UserButton />}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Hola {nombre}, ¿qué te bloquea?
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Cuéntalo como se te ocurra. Órbita lo ordena y busca a quién pedirle ayuda.
          </p>
        </div>

        <BannerDemo />

        <PestanasEstudiante estudianteId={estudianteId} enlaceMuro={enlaceMuro} inicial={pestana} />
      </main>
    </div>
  );
}
