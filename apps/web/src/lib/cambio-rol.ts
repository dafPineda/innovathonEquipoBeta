'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { esRol, guardarRol, panelDe, rolDePublicMetadata } from './rol';

/**
 * Action SOLO de demostración: cambia el rol del usuario en Clerk y lo manda al
 * panel correspondiente.
 *
 * Existe para poder enseñar los dos lados de Orbita con una sola cuenta durante
 * la demo. La protección de rutas no se toca: /estudiante y /tutor siguen
 * exigiendo el rol correcto. Lo que cambia es que el rol se puede cambiar a
 * voluntad desde la interfaz.
 *
 * En producción (NODE_ENV=production) la action se niega a hacer nada y el
 * botón ni siquiera se renderiza.
 */
export async function cambiarRol(formData: FormData): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    redirect('/');
  }

  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const pedido = formData.get('rol');
  if (!esRol(pedido)) {
    // Petición manipulada: nos quedamos donde estamos.
    const user = await currentUser();
    const actual = rolDePublicMetadata(user?.publicMetadata);
    redirect(actual ? panelDe(actual) : '/elegir-rol');
  }

  await guardarRol(userId, pedido);
  redirect(panelDe(pedido));
}
