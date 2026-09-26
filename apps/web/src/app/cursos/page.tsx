import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { idDemo, MODO_SIN_AUTH, PERSONAJES } from '@/lib/modo-demo';
import { panelDe, rolDePublicMetadata, RUTA_ELECCION_ROL, type Rol } from '@/lib/rol';
import { MuroCursos, type Visitante } from '@/components/muro-cursos';
import { BannerDemo, Marca } from '@/components/ui';

/**
 * Muro de cursos: estudiantes y tutores entran, pero solo los tutores publican.
 *
 * El rol sale de Clerk (publicMetadata fresco). En modo demostración no hay
 * cuenta, así que el rol llega por `?como=tutor` desde el enlace de cada panel.
 */
export default async function PaginaCursos({
  searchParams,
}: {
  searchParams: Promise<{ como?: string }>;
}) {
  const visitante = await visitanteActual((await searchParams).como);
  const panel = panelDe(visitante.rol);

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-acento-50/40">
      <header className="border-b border-neutral-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3.5">
          <Marca subtitulo="Cursos y clases" />
          <div className="flex items-center gap-3">
            <Link
              href={panel}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-marca-300 hover:bg-marca-50 hover:text-marca-800"
            >
              ← Mi panel
            </Link>
            {MODO_SIN_AUTH ? null : <UserButton />}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-5 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Cursos y clases</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Clases que publican los tutores de Órbita. Inscríbete, comenta o guarda las que te interesen.
          </p>
        </div>
        <BannerDemo />
        <MuroCursos visitante={visitante} />
      </main>
    </div>
  );
}

async function visitanteActual(como: string | undefined): Promise<Visitante> {
  if (MODO_SIN_AUTH) {
    const rol: Rol = como === 'tutor' ? 'tutor' : 'estudiante';
    const personaje = PERSONAJES[rol];
    return { id: idDemo(rol), nombre: personaje.nombre, iniciales: personaje.iniciales, rol, demo: true };
  }

  const user = await currentUser();
  if (!user) redirect('/sign-in');
  const rol = rolDePublicMetadata(user.publicMetadata);
  if (!rol) redirect(RUTA_ELECCION_ROL);

  const nombre = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Sin nombre';
  const iniciales = nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return { id: user.id, nombre, iniciales, rol, demo: false };
}
