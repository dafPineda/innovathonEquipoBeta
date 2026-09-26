import { describe, expect, it } from 'vitest';
import {
  billableMinutes,
  creditsForMinutes,
  formatCredits,
  formatDuration,
  minutesForCredits,
  roundHalfUp,
  splitFee,
} from '../src/index.js';

describe('roundHalfUp', () => {
  it('redondea .5 hacia arriba (no banker rounding)', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(3.5)).toBe(4);
    expect(roundHalfUp(2.4)).toBe(2);
  });
});

describe('billableMinutes', () => {
  it('aplica el mínimo de 15 minutos', () => {
    expect(billableMinutes(3)).toBe(15);
  });

  it('aplica el máximo de 180 minutos', () => {
    expect(billableMinutes(600)).toBe(180);
  });

  it('deja intacta una duración dentro de la ventana', () => {
    expect(billableMinutes(47)).toBe(47);
  });

  it('rechaza duraciones no positivas', () => {
    expect(() => billableMinutes(0)).toThrowError(/mayor que 0/);
    expect(() => billableMinutes(-5)).toThrowError(/mayor que 0/);
  });
});

describe('creditsForMinutes', () => {
  it('cobra 1 crédito por cada 20 min a tarifa de 3/hora', () => {
    expect(creditsForMinutes(20, 3)).toBe(1);
    expect(creditsForMinutes(40, 3)).toBe(2);
    expect(creditsForMinutes(60, 3)).toBe(3);
  });

  it('aplica el mínimo facturable a sesiones cortísimas', () => {
    // 5 min reales -> 15 facturables -> 15/60*3 = 0.75 -> 1 crédito
    expect(creditsForMinutes(5, 3)).toBe(1);
  });

  it('respeta el tope por sesión', () => {
    expect(creditsForMinutes(600, 3)).toBe(9); // 180 min * 3/60
  });

  it('rechaza tarifas cero o negativas', () => {
    expect(() => creditsForMinutes(30, 0)).toThrowError(/mayor que 0/);
  });
});

describe('minutesForCredits', () => {
  it('es la inversa de creditsForMinutes', () => {
    expect(minutesForCredits(3, 3)).toBe(60);
    expect(minutesForCredits(1, 4)).toBe(15);
  });
});

describe('splitFee', () => {
  it(' reparte 10 créditos: 9 al tutor, 1 a la plataforma', () => {
    expect(splitFee(10, 10)).toEqual({ gross: 10, tutorNet: 9, platformFee: 1 });
  });

  it('redondea la comisión hacia arriba para no perder', () => {
    // 5 * 10% = 0.5 -> la plataforma cobra 1
    const split = splitFee(5, 10);
    expect(split.platformFee).toBe(1);
    expect(split.tutorNet).toBe(4);
    expect(split.platformFee + split.tutorNet).toBe(5);
  });

  it('nunca deja al tutor en cero cuando la comisión se redondea a 1', () => {
    // 1 crédito con 10% --> la comisión sería 0.1 y se redondea a 1, pero el
    // bruto es tan pequeño que el neto debe quedar igual (la plataforma no
    // puede cobrar más de lo que hay).
    const split = splitFee(1, 10);
    expect(split.tutorNet).toBe(1);
    expect(split.platformFee).toBe(0);
  });

  it('devuelve ceros para un bruto cero', () => {
    expect(splitFee(0, 10)).toEqual({ gross: 0, tutorNet: 0, platformFee: 0 });
  });

  it('rechaza comisiones fuera de rango', () => {
    expect(() => splitFee(10, 31)).toThrowError(/entre 0 y 30/);
    expect(() => splitFee(10, -1)).toThrowError(/entre 0 y 30/);
    expect(() => splitFee(10, 2.5)).toThrowError(/entre 0 y 30/);
  });

  it('la suma siempre cuadra al bruto', () => {
    for (let gross = 1; gross <= 200; gross += 1) {
      const split = splitFee(gross, 10);
      expect(split.tutorNet + split.platformFee).toBe(gross);
    }
  });
});

describe('formatCredits / formatDuration', () => {
  it('singular y plural', () => {
    expect(formatCredits(1)).toBe('1 crédito');
    expect(formatCredits(0)).toBe('0 créditos');
    // CLDR `es` no agrupa los números de 4 cifras (1250, no 1.250).
    expect(formatCredits(1250)).toBe('1250 créditos');
    expect(formatCredits(12500)).toBe('12.500 créditos');
  });

  it('duraciones legibles', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30 min');
  });
});
