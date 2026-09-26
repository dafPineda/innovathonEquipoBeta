/**
 * Marca de tipos para que los créditos no se confundan con minutos, soles
 * o porcentajes. El branded type obliga a pasar por `credit()` / `positiveCredit()`.
 */
export type Credit = number & { readonly __brand: 'Credit' };

/** Minutos, siempre resueltos al entero más cercano. */
export type Minutes = number & { readonly __brand: 'Minutes' };

export type Role = 'student' | 'tutor' | 'admin';

/** Razones posibles de un movimiento en el libro mayor (append-only). */
export const CREDIT_REASONS = [
  'signup_bonus',
  'onboarding_bonus',
  'escrow_funded',
  'session_settled',
  'escrow_refunded',
  'redemption',
  'reversal',
  'expired',
  'adjustment',
] as const;

export type CreditReason = (typeof CREDIT_REASONS)[number];

/** Métodos de canje de créditos por dinero simbólico. */
export const REDEMPTION_METHODS = ['gift_card', 'bank_transfer', 'platform_wallet', 'discount'] as const;

export type RedemptionMethod = (typeof REDEMPTION_METHODS)[number];
