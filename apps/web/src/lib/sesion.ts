import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from './db';
import { idDemo, MODO_SIN_AUTH } from './modo-demo';
import { rolDePublicMetadata } from './rol';

/** Usuarios de Clerk que ya sabemos que tienen fila en `usuarios` (por proceso). */
const conocidos = new Set<string>();

/**
 * ¿Quién hace esta petición? Devuelve el id de `usuarios`.
 *
 * - Con Clerk: el id de la sesión. La primera vez crea su fila en la base con
 *   el nombre y el rol de Clerk (el id de Clerk es la llave, regla del proyecto).
 * - En modo demo no hay sesión: el navegador dice quién es con la cabecera
 *   `x-usuario` (demo-estudiante, carla, diego…). Solo vale con DEMO_SIN_AUTH.
 */
export async function usuarioActual(req: Request): Promise<string | null> {
  if (MODO_SIN_AUTH) return req.headers.get('x-usuario') || idDemo('estudiante');

  const { userId } = await auth();
  if (!userId) return null;

  if (!conocidos.has(userId)) {
    const user = await currentUser();
    const nombre =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Sin nombre';
    const rol = rolDePublicMetadata(user?.publicMetadata) ?? 'estudiante';
    const iniciales = nombre
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    await db.usuarios.upsert({
      where: { id: userId },
      create: { id: userId, rol, nombre, iniciales, color: 'from-marca-400 to-acento-500' },
      update: { rol, nombre, iniciales },
    });
    conocidos.add(userId);
  }
  return userId;
}

export function sinSesion() {
  return Response.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
}
