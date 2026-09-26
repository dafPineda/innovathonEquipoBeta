import type { Credit } from './types.js';

/** Códigos estables: el frontend los usa para i18n, no los lea los humanos. */
export type CreditErrorCode =
  | 'NOT_A_CREDIT'
  | 'NEGATIVE_CREDITS'
  | 'NON_INTEGER_CREDITS'
  | 'INVALID_RATE'
  | 'INVALID_FEE'
  | 'INVALID_MINUTES'
  | 'FEE_EXCEEDS_GROSS'
  | 'INSUFFICIENT_BALANCE'
  | 'BELOW_MINIMUM'
  | 'ABOVE_MAXIMUM'
  | 'SELF_TRANSFER'
  | 'NO_PARTICIPANT';

export class CreditError extends Error {
  readonly code: CreditErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: CreditErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CreditError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return { error: 'CreditError', code: this.code, message: this.message, details: this.details };
  }
}

/** Valida y marca un número arbitrario como `Credit`. */
export function credit(value: number, field = 'credit'): Credit {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new CreditError('NOT_A_CREDIT', `${field} debe ser un número`, { field, value });
  }
  if (!Number.isFinite(value)) {
    throw new CreditError('NOT_A_CREDIT', `${field} debe ser finito`, { field, value });
  }
  if (!Number.isInteger(value)) {
    throw new CreditError('NON_INTEGER_CREDITS', `${field} debe ser un entero (no decimales)`, { field, value });
  }
  if (value < 0) {
    throw new CreditError('NEGATIVE_CREDITS', `${field} no puede ser negativo`, { field, value });
  }
  return value as Credit;
}

/** Igual que `credit`, pero exige un valor > 0. */
export function positiveCredit(value: number, field = 'credit'): Credit {
  const c = credit(value, field);
  if (c === 0) {
    throw new CreditError('NEGATIVE_CREDITS', `${field} debe ser mayor que 0`, { field, value });
  }
  return c;
}
