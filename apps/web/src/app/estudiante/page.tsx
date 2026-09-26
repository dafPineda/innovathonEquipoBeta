import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { exigirRol } from '@/lib/rol';
import { MODO_SIN_AUTH, PERSONAJES } from '@/lib/modo-demo';
import { ChatAsistente } from '@/components/chat-asistente';
import { BotonCambiarRol } from '@/components/cambiar-rol';
import { BannerDemo, Logo } from '@/components/ui';

export default async function PanelEstudiante() {
  await exigirRol('estudiante');

  const user = MODO_SIN_AUTH ? null : await currentUser();
  const nombre = user?.firstName ?? user?.username ?? PERSONAJES.estudiante.nombre;

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-indigo-50/40">
      <header className="border-b border-neutral-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <Logo />
            <div>
              <p className="text-sm font-semibold tracking-tight text-neutral-900">Orbita</p>
              <p className="text-[11px] text-neutral-500">Panel del estudiante</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
            Cuéntalo como se te ocurra. Orbita lo ordena y busca a quién pedirle ayuda.
          </p>
        </div>

        <BannerDemo />

        <ChatAsistente />
      </main>
    </div>
  );
}
