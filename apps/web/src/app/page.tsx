import Link from 'next/link';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { panelDe, rolDePublicMetadata, type Rol } from '@/lib/rol';
import { MODO_SIN_AUTH } from '@/lib/modo-demo';
import { Marca } from '@/components/ui';

/**
 * Botonera de entrada. Con el bypass de demo, en vez de pedirte que te
 * registres, te da a elegir panel. Con Clerk normal, los botones de Clerk.
 */
function Entrar({ rol, texto, destacado }: { rol: Rol; texto: string; destacado?: boolean }) {
  if (MODO_SIN_AUTH) {
    return (
      <Link
        href={panelDe(rol)}
        className={
          destacado
            ? 'inline-flex cursor-pointer items-center rounded-xl bg-marca-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-marca-500'
            : 'inline-flex cursor-pointer items-center rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100'
        }
      >
        {texto}
      </Link>
    );
  }
  return null;
}

function EntrarConClerk({ texto, destacado }: { texto: string; destacado?: boolean }) {
  if (MODO_SIN_AUTH) return null;
  return (
    <SignUpButton mode="modal">
      <button
        className={
          destacado
            ? 'cursor-pointer rounded-xl bg-marca-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-marca-500'
            : 'cursor-pointer rounded-lg bg-marca-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-marca-500'
        }
      >
        {texto}
      </button>
    </SignUpButton>
  );
}

const PASOS = [
  {
    titulo: 'Lo cuentas',
    texto: 'Escribes tu duda con tus palabras. No hay que saber explicar el problema con precisión.',
  },
  {
    titulo: 'Órbita lo ordena',
    texto: 'El asistente identifica la materia, el nivel y dónde está el bloqueo real.',
  },
  {
    titulo: 'Te conecta con alguien',
    texto: 'Ves por qué cada tutor encaja, cuánto cuesta y cuándo puede atenderte.',
  },
];

export default async function Inicio() {
  const user = MODO_SIN_AUTH ? null : await currentUser();
  if (user) {
    const rol = rolDePublicMetadata(user.publicMetadata);
    redirect(rol ? panelDe(rol) : '/elegir-rol');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 via-white to-marca-50/60">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Marca className="h-8 w-auto" />
        <div className="flex items-center gap-2">
          {MODO_SIN_AUTH ? (
            <>
              <Entrar rol="estudiante" texto="Estudiante" />
              <Entrar rol="tutor" texto="Tutor" destacado />
            </>
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100">
                  Iniciar sesión
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="cursor-pointer rounded-lg bg-marca-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-marca-500">
                  Crear cuenta
                </button>
              </SignUpButton>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-20">
        <section className="pt-10 sm:pt-16">
          <p className="inline-flex items-center gap-2 rounded-full border border-marca-100 bg-white px-3 py-1 text-xs font-medium text-marca-700">
            <span className="h-1.5 w-1.5 rounded-full bg-acento-500" />
            Tutoría entre estudiantes y profesionales
          </p>

          <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-marca-600 sm:text-5xl">
            Describe tu problema académico y te conectamos con{' '}
            <span className="text-acento-500">quien puede resolverlo.</span>
          </h1>

          <p className="mt-4 max-w-xl text-lg leading-relaxed text-neutral-600">
            Cuéntale tu duda al asistente de IA. Órbita detecta dónde te atascaste y te propone al tutor
            adecuado, con el motivo de cada recomendación.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <EntrarConClerk texto="Empezar gratis" destacado />
            <Entrar rol="estudiante" texto="Entrar como estudiante" destacado />
            <Entrar rol="tutor" texto="Entrar como tutor" />
            <span className="text-xs text-neutral-500">Demostración · funciona sin IA ni base de datos</span>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          {PASOS.map((paso, i) => (
            <div
              key={paso.titulo}
              className="rounded-2xl border border-neutral-200/80 bg-white/80 p-5 shadow-sm backdrop-blur"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-acento-50 text-xs font-semibold text-acento-600">
                {i + 1}
              </span>
              <h2 className="mt-3 text-sm font-semibold text-neutral-900">{paso.titulo}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{paso.texto}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 rounded-2xl border border-neutral-200/80 bg-white/80 p-6 shadow-sm backdrop-blur sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
            También puedes ser quien ayuda
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Si tienes tiempo libre y ganas de ayudar, regístrate como tutor: recibes solicitudes de
            estudiantes filtradas por tu materia y ganas créditos que puedes canjear.
          </p>
          {MODO_SIN_AUTH ? (
            <Entrar rol="tutor" texto="Quiero ser tutor" />
          ) : (
            <SignUpButton mode="modal">
              <button className="mt-4 cursor-pointer rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50">
                Quiero ser tutor
              </button>
            </SignUpButton>
          )}
        </section>
      </main>

      <footer className="border-t border-neutral-200/70 py-6">
        <p className="mx-auto w-full max-w-5xl px-6 text-xs text-neutral-500">
          Órbita · demo de hackathon. Sin pagos reales: los créditos son simbólicos.
        </p>
      </footer>
    </div>
  );
}
