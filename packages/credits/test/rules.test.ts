import { describe, expect, it } from 'vitest';
import {
  CreditError,
  DEFAULT_RULES,
  cancellationPolicy,
  canAfford,
  createRules,
  credit,
  positiveCredit,
  redemptionValueCents,
  validateTransfer,
} from '../src/index.js';

describe('credit()', () => {
  it('acepta enteros no negativos', () => {
    expect(credit(0)).toBe(0);
    expect(credit(42)).toBe(42);
  });

  it('rechaza negativos, decimales, NaN e infinito', () => {
    expect(() => credit(-1)).toThrowError(CreditError);
    expect(() => credit(1.5)).toThrowError(/entero/);
    expect(() => credit(Number.NaN)).toThrowError(CreditError);
    expect(() => credit(Number.POSITIVE_INFINITY)).toThrowError(/finito/);
  });

  it('positiveCredit exige > 0', () => {
    expect(() => positiveCredit(0)).toThrowError(/mayor que 0/);
    expect(positiveCredit(1)).toBe(1);
  });
});

describe('canAfford', () => {
  it('compara saldo contra monto', () => {
    expect(canAfford(10, 10)).toBe(true);
    expect(canAfford(10, 11)).toBe(false);
  });
});

describe('validateTransfer', () => {
  const base = { from: 'user-a', to: 'user-b', amount: 5, balance: 20 };

  it('acepta una transferencia válida', () => {
    expect(validateTransfer(base)).toBe(5);
  });

  it('prohige transferirse a uno mismo', () => {
    expect(() => validateTransfer({ ...base, to: 'user-a' })).toThrowError(/a ti mismo/);
  });

  it('exige saldo suficiente', () => {
    expect(() => validateTransfer({ ...base, balance: 4 })).toThrowError(/Saldo insuficiente/);
  });

  it('respeta el mínimo y el máximo', () => {
    expect(() => validateTransfer({ ...base, amount: 0 })).toThrowError(/mínimo/);
    expect(() => validateTransfer({ ...base, amount: 9999, balance: 9999 })).toThrowError(/máximo/);
  });
});

describe('cancellationPolicy', () => {
  it('devuelve todo con más de 24 h de anticipación', () => {
    expect(cancellationPolicy(10, 48, false)).toEqual({ refund: 10, penalty: 0, free: true });
  });

  it('se queda la mitad si cancela tarde', () => {
    expect(cancellationPolicy(10, 2, false)).toEqual({ refund: 5, penalty: 5, free: false });
  });

  it('no devuelve nada si la sesión ya empezó', () => {
    expect(cancellationPolicy(10, 100, true)).toEqual({ refund: 0, penalty: 10, free: false });
  });

  it('la penalización + el refund cuadran con el escrow', () => {
    for (let escrowed = 1; escrowed <= 50; escrowed++) {
      for (const hours of [0, 1, 23, 24, 25, 72]) {
        const out = cancellationPolicy(escrowed, hours, false);
        expect(out.refund + out.penalty).toBe(escrowed);
      }
    }
  });
});

describe('createRules', () => {
  it('aplica overrides del entorno sobre los defaults', () => {
    const rules = createRules({ platformFeePercent: 15, signupBonusCredits: '30' });
    expect(rules.platformFeePercent).toBe(15);
    expect(rules.signupBonusCredits).toBe(30);
    expect(rules.billingWindow).toEqual(DEFAULT_RULES.billingWindow);
  });

  it('rechaza una comisión fuera de rango', () => {
    expect(() => createRules({ platformFeePercent: 45 })).toThrowError(/entre 0 y 30/);
  });
});

describe('redemptionValueCents', () => {
  it('1 crédito = 0,50 en gift card', () => {
    expect(redemptionValueCents(10, 'gift_card')).toBe(500);
  });

  it('los descuentos pagan menos', () => {
    expect(redemptionValueCents(10, 'discount')).toBe(400);
  });

  it('exige el mínimo de canje', () => {
    expect(() => redemptionValueCents(9, 'gift_card')).toThrowError(/canje mínimo/);
  });
});
