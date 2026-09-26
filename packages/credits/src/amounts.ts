import { CreditError, credit, positiveCredit } from './errors.js';
import type { Credit, Minutes } from './types.js';

export const MINUTES_PER_HOUR = 60;

/** Redondeo "half up": 2.5 -> 3. Evita el banker rounding de Math.round en negativos. */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

export type BillingWindow = {
  /** Minutos mínimos facturables aunque la sesión haya durado menos. */
  minMinutes: number;
  /** Minutos máximos facturables por sesión (protege al estudiante). */
  maxMinutes: number;
};

export const DEFAULT_BILLING_WINDOW: BillingWindow = { minMinutes: 15, maxMinutes: 180 };

/**
 * Minutos facturables = duración real acotada por la ventana de facturación.
 * 5 min reales -> 15 facturables. 300 min reales -> 180 facturables.
 */
export function billableMinutes(
  minutes: number,
  window: BillingWindow = DEFAULT_BILLING_WINDOW,
): Minutes {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new CreditError('INVALID_MINUTES', 'La duración debe ser mayor que 0', { minutes });
  }
  const bounded = Math.min(Math.max(minutes, window.minMinutes), window.maxMinutes);
  return roundHalfUp(bounded) as Minutes;
}

/** credited = minutos facturables / 60 * tarifa_por_hora, redondeado a entero. */
export function creditsForMinutes(
  minutes: number,
  creditsPerHour: Credit | number,
  window: BillingWindow = DEFAULT_BILLING_WINDOW,
): Credit {
  const rate = positiveCredit(creditsPerHour, 'creditsPerHour');
  const billable = billableMinutes(minutes, window);
  return credit(roundHalfUp((billable / MINUTES_PER_HOUR) * rate), 'credits');
}

/** Inversa aproximada: cuántos minutos cubre una cantidad de créditos. */
export function minutesForCredits(credits: Credit | number, creditsPerHour: Credit | number): number {
  const amount = positiveCredit(credits, 'credits');
  const rate = positiveCredit(creditsPerHour, 'creditsPerHour');
  return (amount / rate) * MINUTES_PER_HOUR;
}

export type FeeSplit = {
  /** Lo que gana el tutor. */
  tutorNet: Credit;
  /** Lo que retiene la plataforma. */
  platformFee: Credit;
  gross: Credit;
};

/**
 * Reparte el bruto entre tutor y plataforma.
 *
 * - La comisión se redondea hacia ARRIBA para que la plataforma nunca pierda
 *   centavos por redondeo.
 * - Pero la comisión nunca puede comerse el bruto entero: el tutor siempre
 *   cobra al menos 1 crédito. Sin este tope, una sesión de 1 crédito con
 *   10% dejaría al tutor sin nada.
 */
export function splitFee(gross: Credit | number, feePercent: number): FeeSplit {
  const amount = credit(gross, 'gross');
  if (!Number.isInteger(feePercent) || feePercent < 0 || feePercent > 30) {
    throw new CreditError('INVALID_FEE', 'La comisión debe ser un entero entre 0 y 30 %', { feePercent });
  }
  if (amount === 0) {
    return { gross: amount, platformFee: credit(0), tutorNet: credit(0) };
  }
  const uncappedFee = Math.ceil((amount * feePercent) / 100);
  const platformFee = credit(Math.min(uncappedFee, amount - 1), 'platformFee');
  const tutorNet = credit(amount - platformFee, 'tutorNet');
  if (tutorNet <= 0) {
    throw new CreditError('FEE_EXCEEDS_GROSS', 'La comisión se comería todo el pago al tutor', {
      gross: amount,
      feePercent,
    });
  }
  return { gross: amount, platformFee, tutorNet };
}

/** Formato para UI: "12 créditos" / "1 crédito". */
export function formatCredits(amount: Credit | number, locale = 'es'): string {
  const value = credit(amount);
  const plural = value === 1 ? 'crédito' : 'créditos';
  return `${new Intl.NumberFormat(locale).format(value)} ${plural}`;
}

/** Formato de duración: "1 h 30 min". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new CreditError('INVALID_MINUTES', 'Duración inválida', { minutes });
  }
  const total = Math.round(minutes);
  const h = Math.floor(total / MINUTES_PER_HOUR);
  const m = total % MINUTES_PER_HOUR;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
