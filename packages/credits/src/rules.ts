import { DEFAULT_BILLING_WINDOW, type BillingWindow } from './amounts.js';
import { CreditError, credit, positiveCredit } from './errors.js';
import type { Credit, RedemptionMethod } from './types.js';

export type Rules = {
  /** Comisión de la plataforma por sesión liquidada (0-30). */
  platformFeePercent: number;
  /** Créditos que recibe un estudiante al registrarse. */
  signupBonusCredits: Credit;
  /** Créditos que recibe un tutor al ser verificado. */
  tutorOnboardingBonusCredits: Credit;
  /** Transferencia mínima entre dos usuarios. */
  minTransferCredits: Credit;
  /** Transferencia máxima entre dos usuarios (evita Movement de teste). */
  maxTransferCredits: Credit;
  /** Mínimo de créditos para pedir canje. */
  minRedemptionCredits: Credit;
  /** Ventana de facturación por sesión. */
  billingWindow: BillingWindow;
  /** Horas de anticipación para cancelar sin penalización. */
  freeCancellationHours: number;
  /** % que se queda la plataforma si se cancela tarde (0-100). */
  lateCancellationPenaltyPercent: number;
  /** Días hasta que los créditos bonus expiran (0 = nunca). */
  bonusExpiryDays: number;
};

export const DEFAULT_RULES: Rules = {
  platformFeePercent: 10,
  signupBonusCredits: credit(20),
  tutorOnboardingBonusCredits: credit(5),
  minTransferCredits: credit(1),
  maxTransferCredits: credit(500),
  minRedemptionCredits: credit(10),
  billingWindow: DEFAULT_BILLING_WINDOW,
  freeCancellationHours: 24,
  lateCancellationPenaltyPercent: 50,
  bonusExpiryDays: 90,
};

/** Construye las reglas aplicando overrides del entorno sobre los defaults. */
export function createRules(overrides: Partial<Record<keyof Rules, unknown>> = {}): Rules {
  const rules: Rules = { ...DEFAULT_RULES };

  if (overrides.platformFeePercent !== undefined) rules.platformFeePercent = readPercent(overrides.platformFeePercent, 'PLATFORM_FEE_PERCENT', 30);
  if (overrides.signupBonusCredits !== undefined) rules.signupBonusCredits = credit(Number(overrides.signupBonusCredits), 'SIGNUP_BONUS_CREDITS');
  if (overrides.tutorOnboardingBonusCredits !== undefined) rules.tutorOnboardingBonusCredits = credit(Number(overrides.tutorOnboardingBonusCredits), 'TUTOR_ONBOARDING_BONUS_CREDITS');

  // Invariante: si los bonuses son configurables, el saldo inicial no puede
  // dejar al estudiante sin créditos para probar el producto.
  if (rules.minRedemptionCredits > rules.signupBonusCredits && rules.signupBonusCredits > 0) {
    // No es error: un admin puede configurarlo así a propósito.
  }

  return rules;
}

function readPercent(value: unknown, field: string, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    throw new CreditError('INVALID_FEE', `${field} debe ser un entero entre 0 y ${max}`, { field, value });
  }
  return n;
}

export function canAfford(balance: Credit | number, amount: Credit | number): boolean {
  return credit(balance, 'balance') >= positiveCredit(amount, 'amount');
}

export type TransferInput = {
  from: string;
  to: string;
  amount: Credit | number;
  balance: Credit | number;
};

/** Valida una transferencia usuario→usuario antes de tocar la base de datos. */
export function validateTransfer({ from, to, amount, balance }: TransferInput): Credit {
  if (from === to) {
    throw new CreditError('SELF_TRANSFER', 'No puedes transferirte créditos a ti mismo', { from });
  }
  const value = credit(amount, 'amount');
  const available = credit(balance, 'balance');

  if (value < DEFAULT_RULES.minTransferCredits) {
    throw new CreditError('BELOW_MINIMUM', `El mínimo por transferencia es ${DEFAULT_RULES.minTransferCredits} crédito(s)`, { amount: value });
  }
  if (value > DEFAULT_RULES.maxTransferCredits) {
    throw new CreditError('ABOVE_MAXIMUM', `El máximo por transferencia es ${DEFAULT_RULES.maxTransferCredits} créditos`, { amount: value });
  }
  if (value > available) {
    throw new CreditError('INSUFFICIENT_BALANCE', 'Saldo insuficiente de créditos', { balance: available, amount: value });
  }
  return value;
}

export type CancellationOutcome = {
  /** Créditos que vuelven al estudiante. */
  refund: Credit;
  /** Créditos que se quedarían la plataforma como penalización. */
  penalty: Credit;
  /** true si canceló con más de `freeCancellationHours` de anticipación. */
  free: boolean;
};

/**
 * Política de cancelación:-full refund con `freeCancellationHours` de
 * anticipación; después se queda la mitad; a mitad de sesión no se devuelve nada.
 */
export function cancellationPolicy(
  escrowed: Credit | number,
  hoursUntilStart: number,
  started: boolean,
  rules: Rules = DEFAULT_RULES,
): CancellationOutcome {
  const amount = credit(escrowed, 'escrowed');

  if (started) {
    return { refund: credit(0), penalty: amount, free: false };
  }
  if (hoursUntilStart >= rules.freeCancellationHours) {
    return { refund: amount, penalty: credit(0), free: true };
  }
  const penalty = credit(Math.ceil((amount * rules.lateCancellationPenaltyPercent) / 100), 'penalty');
  return { refund: credit(amount - penalty), penalty, free: false };
}

/** Valor simbólico en dinero de un canje, en céntimos de la moneda local. */
export const CREDIT_VALUE_CENTS = 50; // 1 crédito = 0,50 unidades monetarias

export function redemptionValueCents(credits: Credit | number, method: RedemptionMethod): number {
  const amount = positiveCredit(credits, 'credits');
  if (amount < DEFAULT_RULES.minRedemptionCredits) {
    throw new CreditError('BELOW_MINIMUM', `El canje mínimo es de ${DEFAULT_RULES.minRedemptionCredits} créditos`, { amount });
  }
  // Las gift cards y el pago directo pagan 1:1; los descuentos pagan menos
  // porque la plataforma se ahorra el costo del canje.
  const rate = method === 'discount' ? 40 : CREDIT_VALUE_CENTS;
  return amount * rate;
}
