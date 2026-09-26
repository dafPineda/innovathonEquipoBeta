import { CreditError } from '@beta/credits';
import { DatabaseError } from '@beta/db';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

/**
 * Traductor único de errores → HTTP. Regla: el cliente recibe siempre
 * `{ error: { code, message, details } }`, nunca un stack trace.
 */
const STATUS_BY_CODE: Record<string, number> = {
  NOT_A_CREDIT: 400,
  NEGATIVE_CREDITS: 400,
  NON_INTEGER_CREDITS: 400,
  INVALID_RATE: 409, // el estado actual no lo permite
  INVALID_FEE: 500, // sería un bug de configuración
  INVALID_MINUTES: 400,
  FEE_EXCEEDS_GROSS: 500,
  INSUFFICIENT_BALANCE: 409, // 402 tempting, pero 409 + balance es más claro
  BELOW_MINIMUM: 400,
  ABOVE_MAXIMUM: 400,
  SELF_TRANSFER: 400,
  NO_PARTICIPANT: 403,
};

export function creditErrorToHttp(error: CreditError): { status: number; body: unknown } {
  return {
    status: STATUS_BY_CODE[error.code] ?? 400,
    body: { error: error.toJSON() },
  };
}

export function sendCreditError(reply: FastifyReply, error: CreditError): FastifyReply {
  const { status, body } = creditErrorToHttp(error);
  return reply.status(status).send(body);
}

/** Un fallo de infra responde 503, no 500 genérico: reintentar tiene sentido. */
export function sendDatabaseError(reply: FastifyReply, error: DatabaseError, log?: (err: unknown) => void): FastifyReply {
  log?.(error);
  return reply.status(503).send({ error: error.toJSON() });
}

/** Envuelve un handler async y deja que el errorHandler global formatee. */
export function handler<T>(
  fn: (request: FastifyRequest) => Promise<T>,
): (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply> {
  return async (request, reply) => {
    const result = await fn(request);
    return reply.send(result);
  };
}

/** Convierte errores de Zod en el mismo formato de error que el resto. */
export function zodToError(error: z.ZodError): CreditError {
  const first = error.issues[0];
  const field = first?.path.join('.') ?? 'body';
  const message = first ? `${field}: ${first.message}` : 'Datos inválidos';
  return new CreditError('NOT_A_CREDIT', message, {
    issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}
