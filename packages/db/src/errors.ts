import { CreditError, type CreditErrorCode } from '@beta/credits';

/**
 * Fallo de infraestructura (Supabase caído, red, timeout, DNS).
 * No es un error de negocio: nunca debe terminar como 4xx, porque el cliente
 * no tiene la culpa y reintentar sí sirve.
 */
export class DatabaseError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'DatabaseError';
    this.cause = cause;
  }

  toJSON() {
    return {
      error: 'DatabaseError',
      code: 'DATABASE_UNAVAILABLE',
      message: 'No pudimos conectar con la base de datos. Intenta de nuevo en un momento.',
    };
  }
}

/**
 * Traduce los errores de Postgres/Supabase al dominio de créditos.
 *
 * Las funciones de la BD lanzan `CODE_NEGRO: mensaje legible` (ej:
 * `SALDO_INSUFICIENTE: el estudiante tiene 3 créditos y la sesión cuesta 10`).
 * El prefijo es el contrato estable; el mensaje es para humanos y puede
 * cambiar sin romper a los clientes.
 *
 * Cualquier otra cosa (fetch failed, timeout, TypeError del cliente) NO es un
 * error de negocio: sale como DatabaseError para responder 503.
 */
const CODE_TO_DOMAIN: Record<string, CreditErrorCode> = {
  SALDO_INSUFICIENTE: 'INSUFFICIENT_BALANCE',
  CUENTA_INEXISTENTE: 'INSUFFICIENT_BALANCE',
  AUTOSERVICIO: 'SELF_TRANSFER',
  PAGO_MINIMO: 'BELOW_MINIMUM',
  CANJE_MINIMO: 'BELOW_MINIMUM',
  CANJE_LIMITE: 'ABOVE_MAXIMUM',
  BOVEDA_INVALIDA: 'INVALID_RATE',
  ESTADO_INVALIDO: 'INVALID_RATE',
  DURACION_INVALIDA: 'INVALID_MINUTES',
  CALIFICACION_INVALIDA: 'INVALID_MINUTES',
  YA_CALIFICADA: 'INVALID_RATE',
  SOLO_ESTUDIANTE: 'NO_PARTICIPANT',
  NO_PARTICIPANTE: 'NO_PARTICIPANT',
  AJUSTE_INVALIDO: 'INVALID_RATE',
};

type DbErrorLike = { message?: string; code?: string; details?: string | null } | null | undefined;

export function mapDbError(
  error: DbErrorLike,
  fallbackMessage = 'Error de base de datos',
): CreditError | DatabaseError {
  const raw = error?.message ?? fallbackMessage;
  const separator = raw.indexOf(':');
  const prefix = (separator === -1 ? raw : raw.slice(0, separator)).trim().toUpperCase();
  const human = separator === -1 ? raw : raw.slice(separator + 1).trim();

  const domainCode = CODE_TO_DOMAIN[prefix];
  if (domainCode) {
    return new CreditError(domainCode, human || raw, { dbPrefix: prefix, dbCode: error?.code });
  }
  return new DatabaseError(human || raw, error);
}

/** Lanza el error de dominio si la query de Supabase falló. */
export function unwrap<T>(result: { data: T; error: DbErrorLike }): T {
  if (result.error) throw mapDbError(result.error);
  return result.data;
}
