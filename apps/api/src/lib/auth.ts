import { CreditError } from '@beta/credits';
import type { DbClient } from '@beta/db';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToError } from './errors.js';

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  /** 'jwt' = token verificado por Supabase. 'dev-header' = solo desarrollo. */
  source: 'jwt' | 'dev-header';
};

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

const bearerSchema = z.string().regex(/^Bearer\s+(.+)$/i, 'Formato esperado: Bearer <token>');

/**
 * Verifica el JWT contra Supabase.
 *
 * En desarrollo se acepta también `x-user-id` para probar la API con curl sin
 * token. Ese atajo se apaga solo si NODE_ENV=production.
 */
export function createAuthenticator(client: DbClient, opts: { allowDevHeader: boolean }) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;

    if (typeof header === 'string') {
      const parsed = bearerSchema.safeParse(header);
      if (parsed.success) {
        const token = parsed.data.replace(/^Bearer\s+/i, '');
        const { data, error } = await client.auth.getUser(token);
        if (error || !data.user) {
          throw new CreditError('NO_PARTICIPANT', 'Token inválido o vencido', { reason: error?.message });
        }
        request.user = { id: data.user.id, email: data.user.email ?? null, source: 'jwt' };
        return;
      }
    }

    const devId = request.headers['x-user-id'];
    if (opts.allowDevHeader && typeof devId === 'string') {
      request.user = { id: devId, email: null, source: 'dev-header' };
      return;
    }

    throw new CreditError('NO_PARTICIPANT', 'Falta el header Authorization: Bearer <token>');
  };
}

/** Devuelve el usuario autenticado o falla (usar después de `authenticate`). */
export function currentUser(request: FastifyRequest): AuthenticatedUser {
  if (!request.user) {
    throw new CreditError('NO_PARTICIPANT', 'Endpoint protegido: autentícate primero');
  }
  return request.user;
}

/** Igual que currentUser, pero permite acting-user para endpoints de staff. */
export function parseZod<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw zodToError(result.error);
  return result.data;
}
