import type { Rol } from './rol';

/**
 * Modo demostración: se salta la autenticación de Clerk.
 *
 * Para qué sirve: en un ensayo de hackathon no quieres depender de escribir
 * correos, contraseñas ni de tener dos sesiones abiertas. Con DEMO_SIN_AUTH=1
 * los dos paneles se abren directo, sin login y sin comprobación de rol.
 *
 * Para volver a la normalidad: quita la variable de .env.local y reinicia.
 * No hay que tocar ni una línea de código.
 *
 * Solo funciona con `pnpm dev`. Es un límite deliberado: un build servido con
 * `pnpm start` corre con NODE_ENV=production, y un bypass de autenticación en
 * producción es un agujero de seguridad. Si alguien lo activa ahí, la app
 * ignora el flag y sigue exigiendo Clerk (y avisa por consola).
 */
const solicitado = process.env.DEMO_SIN_AUTH === '1';
const enProduccion = process.env.NODE_ENV === 'production';

export const MODO_SIN_AUTH = solicitado && !enProduccion;

if (solicitado && enProduccion) {
  console.warn(
    '[orbita] DEMO_SIN_AUTH=1 se ignora en producción: la autenticación de Clerk sigue activa.',
  );
}

/** Los dos perfiles de la demo, para que los paneles no parezcan anónimos. */
export const PERSONAJES: Record<Rol, { nombre: string; iniciales: string }> = {
  estudiante: { nombre: 'Ana', iniciales: 'AN' },
  tutor: { nombre: 'Carla', iniciales: 'CA' },
};
