import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { MODO_SIN_AUTH } from './modo-demo';

/**
 * Roles de Orbita. Se guardan en el `publicMetadata` de Clerk, que es la
 * única fuente de verdad: la base de datos (Prisma) guardado el id de Clerk,
 * no el rol duplicado.
 */
export const ROLES = ['estudiante', 'tutor'] as const;

export type Rol = (typeof ROLES)[number];

/** A dónde va cada rol después de registrarse o de entrar. */
export const RUTA_POR_ROL: Record<Rol, string> = {
  estudiante: '/estudiante',
  tutor: '/tutor',
};

export const RUTA_ELECCION_ROL = '/elegir-rol';

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
}

/**
 * Lee el rol del publicMetadata del usuario.
 * Acepta `rol` y `role` para no romper nada si alguien guardó la otra clave.
 */
export function rolDePublicMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Rol | null {
  if (!metadata) return null;
  const candidato = metadata.rol ?? metadata.role;
  return esRol(candidato) ? candidato : null;
}

/** Rol leído del usuario de Clerk recién consultado a la API (nunca cacheado). */
export async function rolActual(): Promise<Rol | null> {
  const user = await currentUser();
  return rolDePublicMetadata(user?.publicMetadata);
}

/**
 * Guarda el rol en el publicMetadata de Clerk.
 * `clerkClient()` es la vía de servidor con la secret key: nunca en el cliente.
 */
export async function guardarRol(userId: string, rol: Rol): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, { publicMetadata: { rol } });
}

/**
 * Puerta de las páginas privadas. Es la verificación que manda, porque
 * `currentUser()` siempre lee el dato fresco de Clerk.
 *
 * El middleware (proxy.ts) también revisa el rol, pero con el claim del session
 * token, que puede ir atrasado unos segundos tras cambiar el rol. Aquí no hay
 * ese problema: si el rol no coincide, se corrige en el acto.
 */
export async function exigirRol(rol: Rol): Promise<void> {
  // En modo demostración no hay sesión que comprobar: se entra directo.
  if (MODO_SIN_AUTH) return;

  const user = await currentUser();

  if (!user) redirect('/sign-in');

  const actual = rolDePublicMetadata(user.publicMetadata);

  // Todavía no eligió rol: a la pantalla de elección.
  if (!actual) redirect(RUTA_ELECCION_ROL);

  // Es del otro rol: a su panel, no a un 403.
  if (actual !== rol) redirect(RUTA_POR_ROL[actual]);
}

/** ¿Qué panel le corresponde a este usuario? */
export function panelDe(rol: Rol): string {
  return RUTA_POR_ROL[rol];
}

declare global {
  /**
   * Claim personalizado del session token de Clerk.
   *
   * Clerk v7 ya no mete el publicMetadata en el token por defecto. Para que el
   * middleware pueda leer el rol sin ir a la API, hay que añadir este claim en
   * Clerk Dashboard → Sessions → Customize session token:
   *
   *   { "rol": "{{user.public_metadata.rol}}" }
   *
   * Si no lo añades, el middleware sigue funcionando: simplemente no puede
   * expulsar a un usuario del panel ajeno hasta que el token se refresque, y
   * la página (que sí lee el dato fresco) lo corrige igual.
   */
  interface CustomJwtSessionClaims {
    rol?: Rol;
  }
}
