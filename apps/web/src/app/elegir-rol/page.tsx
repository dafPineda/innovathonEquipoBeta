import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { panelDe, rolDePublicMetadata } from '@/lib/rol';
import { MODO_SIN_AUTH } from '@/lib/modo-demo';
import { Logo, Tarjeta } from '@/components/ui';
import { elegirRol } from './acciones';

const OPCIONES = [
  {
    rol: 'estudiante',
    titulo: 'Soy estudiante',
    descripcion: 'Tengo una duda académica y necesito ayuda para resolverla.',
    detalles: ['Describe tu problema con tus palabras', 'Recibe propuestas de tutores', 'Pagas con créditos'],
    color: 'from-indigo-400 to-violet-500',
  },
  {
    rol: 'tutor',
    titulo: 'Soy tutor',
    descripcion: 'Quiero ayudar a estudiantes con lo que sé y ganar créditos.',
    detalles: ['Solicitudes filtradas por tu materia', 'Tú eliges cuáles aceptas', 'Canjeas tus créditos'],
    color: 'from-emerald-400 to-teal-500',
  },
] as const;

export default async function PaginaElegirRol() {
  // Sin Clerk no hay rol que elegir: se vuelve a la portada, que sí ofrece
  // acceso directo a los dos paneles.
  if (MODO_SIN_AUTH) redirect('/');

  const user = await currentUser();
  if (!user) redirect('/sign-in');

  // currentUser() lee el dato fresco: si el rol ya existe, no se pregunta dos veces.
  const rolActual = rolDePublicMetadata(user.publicMetadata);
  if (rolActual) redirect(panelDe(rolActual));

  const nombre = user.firstName ?? user.username ?? 'bienvenido';

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 via-white to-indigo-50/50">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 py-5">
        <Logo className="h-6 w-6" />
        <span className="text-sm font-semibold tracking-tight text-neutral-900">Orbita</span>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-20">
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-neutral-900">Hola {nombre}</h1>
        <p className="mt-2 text-neutral-600">
          Una última cosa antes de entrar: ¿qué rol quieres usar en Orbita?
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {OPCIONES.map((opcion) => (
            <form key={opcion.rol} action={elegirRol}>
              <input type="hidden" name="rol" value={opcion.rol} />
              <button
                type="submit"
                className="group h-full w-full cursor-pointer rounded-2xl border border-neutral-200/80 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${opcion.color} text-sm font-semibold text-white`}
                >
                  {opcion.rol === 'estudiante' ? 'ES' : 'TU'}
                </span>

                <span className="mt-4 block text-base font-semibold text-neutral-900">{opcion.titulo}</span>
                <span className="mt-1.5 block text-sm leading-relaxed text-neutral-600">
                  {opcion.descripcion}
                </span>

                <ul className="mt-4 space-y-1.5">
                  {opcion.detalles.map((detalle) => (
                    <li key={detalle} className="flex items-start gap-2 text-xs text-neutral-500">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                      {detalle}
                    </li>
                  ))}
                </ul>
              </button>
            </form>
          ))}
        </div>

        <Tarjeta className="mt-8 text-xs leading-relaxed text-neutral-500">
          El rol se guarda en los metadatos públicos de tu cuenta y define a qué panel puedes entrar.
          Si entras por el panel equivocado, Orbita te devuelve al tuyo.
        </Tarjeta>
      </main>
    </div>
  );
}
