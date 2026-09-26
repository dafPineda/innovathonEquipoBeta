import Link from 'next/link';
import { cambiarRol } from '@/lib/cambio-rol';
import { MODO_SIN_AUTH } from '@/lib/modo-demo';
import { panelDe, ROLES, type Rol } from '@/lib/rol';

/**
 * Botón de demostración: alterna entre el panel de estudiante y el de tutor.
 * No se renderiza en producción.
 *
 * Con Clerk activo cambia el rol de la cuenta (server action). Con el bypass de
 * demo no hay cuenta que cambiar, así que es un enlace directo al otro panel.
 */
export function BotonCambiarRol({ actual }: { actual: Rol }) {
  if (process.env.NODE_ENV === 'production') return null;

  const otro = ROLES.find((rol) => rol !== actual);
  if (!otro) return null;

  const clase =
    'inline-block cursor-pointer rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-marca-300 hover:bg-marca-50 hover:text-marca-800';

  if (MODO_SIN_AUTH) {
    return (
      <Link href={panelDe(otro)} className={clase} title="Cambiar de vista (modo demostración)">
        ⇄ Ver como {otro}
      </Link>
    );
  }

  return (
    <form action={cambiarRol} title="Herramienta de demostración: cambia el rol de esta cuenta">
      <input type="hidden" name="rol" value={otro} />
      <button type="submit" className={clase}>
        ⇄ Ver como {otro}
      </button>
    </form>
  );
}
