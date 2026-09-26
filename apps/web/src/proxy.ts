import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { RUTA_POR_ROL, RUTA_ELECCION_ROL, type Rol } from '@/lib/rol';
import { MODO_SIN_AUTH } from '@/lib/modo-demo';

/**
 * Rutas que exigen sesión. La verificación fina de rol la hace cada página
 * (ver `exigirRol` en src/lib/rol.ts) porque ahí se lee el publicMetadata
 * fresco de Clerk, sin el retraso del session token.
 */
const RUTAS_PROTEGIDAS = ['/estudiante', '/tutor', '/cursos', RUTA_ELECCION_ROL];

/** ¿Qué rol exige este path? `null` si la ruta no es un panel. */
function rolDeRuta(pathname: string): Rol | null {
  for (const rol of ['estudiante', 'tutor'] as const) {
    const base = RUTA_POR_ROL[rol];
    if (pathname === base || pathname.startsWith(`${base}/`)) return rol;
  }
  return null;
}

export default clerkMiddleware(async (auth, req) => {
  // Modo demostración: los paneles se abren sin sesión. Fuera de producción
  // esto no se aplica (ver src/lib/modo-demo.ts).
  if (MODO_SIN_AUTH) return;

  const { pathname } = req.nextUrl;

  if (RUTAS_PROTEGIDAS.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))) {
    // Sin sesión no se pasa. Clerk redirige a /sign-in.
    await auth.protect();

    const { sessionClaims } = await auth();
    const rolDelToken = sessionClaims?.rol ?? null;
    const rolEsperado = rolDeRuta(pathname);

    // Solo expulsamos cuando el claim dice claramente que el rol es otro.
    // Si el claim aún no existe (o va atrasado tras cambiar el rol), dejamos
    // pasar: la página decide con el dato fresco. Así no hay bucles de
    // redirección justo después de registrarse.
    if (rolEsperado && rolDelToken && rolDelToken !== rolEsperado) {
      const destino = RUTA_POR_ROL[rolDelToken];
      return NextResponse.redirect(new URL(destino, req.url));
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
