import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { exigirRol } from '@/lib/rol';
import { MODO_SIN_AUTH, PERSONAJES } from '@/lib/modo-demo';
import { BotonCambiarRol } from '@/components/cambiar-rol';
import { BandejaTutor } from '@/components/bandeja-tutor';
import { PapelTutor } from '@/components/papel-tutor';
import { Avatar, BannerDemo, Etiqueta, Marca } from '@/components/ui';

export default async function PanelTutor() {
  await exigirRol('tutor');

  const user = MODO_SIN_AUTH ? null : await currentUser();
  const nombre = user?.firstName ?? user?.username ?? PERSONAJES.tutor.nombre;

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-emerald-50/40">
      <header className="border-b border-neutral-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <Marca subtitulo="Panel del tutor" />
          <div className="flex items-center gap-3">
            <Link
              href={MODO_SIN_AUTH ? '/cursos?como=tutor' : '/cursos'}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              Cursos
            </Link>
            <BotonCambiarRol actual="tutor" />
            <span className="hidden text-sm text-neutral-600 sm:inline">{nombre}</span>
            {MODO_SIN_AUTH ? null : <UserButton />}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
        {MODO_SIN_AUTH ? (
          <>
            <BannerDemo>
              Cuentas de prueba: puedes entrar como cualquier tutor y alternar entre ellos. Todo sale de
              tu navegador.
            </BannerDemo>
            <PapelTutor />
          </>
        ) : (
          <>
            <PerfilTutorConClerk nombre={nombre} />
            <BannerDemo>
              Las solicitudes de abajo son de ejemplo. No hay base de datos detrás.
            </BannerDemo>
            <BandejaTutor />
          </>
        )}
      </main>
    </div>
  );
}

/** Con Clerk vivo mostramos la cuenta real, sin selector de personas. */
function PerfilTutorConClerk({ nombre }: { nombre: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <Avatar
        iniciales={nombre.slice(0, 2).toUpperCase()}
        color="from-emerald-400 to-teal-500"
        tam="lg"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">{nombre}</h1>
          <Etiqueta tono="verde">verificado</Etiqueta>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Añade aquí tus materias y tu tarifa cuando conectemos la base de datos.
        </p>
      </div>
    </div>
  );
}
