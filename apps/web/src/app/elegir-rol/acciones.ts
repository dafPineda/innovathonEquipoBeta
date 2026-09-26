'use server';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { esRol, guardarRol, panelDe } from '@/lib/rol';

/**
 * Server Action: guarda el rol en el publicMetadata de Clerk y manda a su panel.
 *
 * La directiva 'use server' va arriba, a nivel de archivo, a propósito. Inline
 * dentro de la función es válido, pero es fácil de perder al reescribir el
 * archivo, y el síntoma es críptico: React se queja de que no puede pasar la
 * función a un Client Component.
 */
export async function elegirRol(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const rol = formData.get('rol');
  if (!esRol(rol)) {
    // Petición manipulada: no inventamos nada, se vuelve a la elección.
    redirect('/elegir-rol');
  }

  await guardarRol(userId, rol);
  redirect(panelDe(rol));
}
