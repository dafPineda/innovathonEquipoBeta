import { SignIn } from '@clerk/nextjs';

// La traducción al español se configura una sola vez en el ClerkProvider
// (src/app/layout.tsx). Aquí no se repite.
export default function PaginaIniciarSesion() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <SignIn />
    </div>
  );
}
