import { CreditError } from '@beta/credits';
import { DatabaseError, type CreditRepository, type DbClient, type RequestsRepository } from '@beta/db';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

/** Doubles mínimos: la API solo necesita que el cliente "no esté" y sepa leer. */
const fakeDb = {
  from: () => ({
    select: () => ({
      limit: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
    }),
    insert: () => ({
      select: () => ({ single: async () => ({ data: { id: 'req_1' }, error: null }) }),
    }),
    eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
  }),
  auth: {
    getUser: async () => ({ data: { user: null }, error: { message: 'invalid jwt' } }),
  },
} as unknown as DbClient;

const fakeCredits = {
  getBalance: async (userId: string) => ({ balance: 42, lifetime_earned: 60, lifetime_spent: 18, userId }),
  getHistory: async () => [],
  bookSession: async () => 'sess_1',
  startSession: async () => '2026-01-01T00:00:00.000Z',
  settleSession: async (input: { minutes: number }) => ({
    session_id: 'sess_1',
    duration_minutes: input.minutes,
    rate_per_hour: 3,
    gross: 3,
    platform_fee: 1,
    tutor_net: 2,
    refunded: 0,
    capped_by_escrow: false,
    fee_percent: 10,
  }),
  cancelSession: async () => ({
    session_id: 'sess_1',
    refunded: 5,
    penalty: 0,
    free_cancellation: true,
    free_cancellation_hours: 24,
  }),
  rateSession: async () => ({ session_id: 'sess_1', rating: 5, tutor_rating: 4.8, rating_count: 3 }),
  redeem: async (input: { credits: number }) => ({
    redemption_id: 'red_1',
    code: 'AB12-CD34',
    credits: input.credits,
    cash_value_cents: input.credits * 50,
    currency: 'PEN',
    method: 'gift_card',
    status: 'pending',
  }),
} as unknown as CreditRepository;

const fakeRequests = {
  createRequest: async () => ({ id: 'req_1', status: 'open', credits_offered: 3, created_at: '2026-01-01' }),
  listOpenRequests: async () => [],
  listTutors: async () => [],
  getProfile: async () => null,
} as unknown as RequestsRepository;

let app: FastifyInstance;

async function makeApp(allowDevHeader = true): Promise<FastifyInstance> {
  return buildServer({
    db: fakeDb,
    credits: fakeCredits,
    requests: fakeRequests,
    rules: { platformFeePercent: 10, signupBonusCredits: 20, tutorOnboardingBonusCredits: 5 },
    version: 'test',
    allowDevHeader,
    logger: false,
  });
}

beforeEach(async () => {
  app = await makeApp();
});

afterEach(async () => {
  await app.close();
});

const DEV_USER = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

describe('GET /health', () => {
  it('responde sin autenticación e informa la base de datos', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      service: 'intercambio-api',
      database: { reachable: true },
    });
  });
});

describe('autenticación', () => {
  it('rechaza endpoints protegidos sin token', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/me/credits' });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('NO_PARTICIPANT');
  });

  it('rechaza un JWT inválido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me/credits',
      headers: { authorization: 'Bearer token-falso' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('acepta x-user-id solo cuando allowDevHeader está activo', async () => {
    const dev = await app.inject({
      method: 'GET',
      url: '/v1/me/credits',
      headers: { 'x-user-id': DEV_USER },
    });
    expect(dev.statusCode).toBe(200);
    expect(dev.json()).toMatchObject({ userId: DEV_USER, balance: 42 });

    const prod = await makeApp(false);
    const blocked = await prod.inject({
      method: 'GET',
      url: '/v1/me/credits',
      headers: { 'x-user-id': DEV_USER },
    });
    expect(blocked.statusCode).toBe(403);
    await prod.close();
  });
});

describe('validación de entrada', () => {
  it('devuelve 400 con el detalle del campo cuando el body no cumple el schema', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions/' + SESSION_ID + '/settle',
      headers: { 'x-user-id': DEV_USER },
      payload: { minutes: 0 },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.message).toMatch(/minutes/);
    expect(body.error.details.issues[0].path).toBe('minutes');
  });

  it('rechaza ids que no son UUID', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions/no-es-un-uuid/settle',
      headers: { 'x-user-id': DEV_USER },
      payload: { minutes: 30 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toMatch(/UUID/);
  });
});

describe('flujo de créditos', () => {
  it('liquidar una sesión devuelve el reparto bruto/comisión/neto', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${SESSION_ID}/settle`,
      headers: { 'x-user-id': DEV_USER },
      payload: { minutes: 45 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().settlement).toMatchObject({
      gross: 3,
      platform_fee: 1,
      tutor_net: 2,
    });
  });

  it('canjear créditos devuelve 201 con el código', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/credits/redeem',
      headers: { 'x-user-id': DEV_USER },
      payload: { credits: 10, method: 'gift_card' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().redemption).toMatchObject({
      credits: 10,
      cash_value_cents: 500,
      code: 'AB12-CD34',
    });
  });

  it('propaga el error de dominio con su código HTTP (saldo insuficiente = 409)', async () => {
    const app2 = await buildServer({
      db: fakeDb,
      credits: {
        ...fakeCredits,
        redeem: async () => {
          throw new CreditError('INSUFFICIENT_BALANCE', 'Saldo insuficiente de créditos', {
            balance: 3,
          });
        },
      } as unknown as CreditRepository,
      requests: fakeRequests,
      rules: { platformFeePercent: 10, signupBonusCredits: 20, tutorOnboardingBonusCredits: 5 },
      version: 'test',
      allowDevHeader: true,
      logger: false,
    });

    const response = await app2.inject({
      method: 'POST',
      url: '/v1/me/credits/redeem',
      headers: { 'x-user-id': DEV_USER },
      payload: { credits: 10 },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
      details: { balance: 3 },
    });
    await app2.close();
  });

  it('un fallo de Supabase responde 503, no 400 (reintentar sí sirve)', async () => {
    const app3 = await buildServer({
      db: fakeDb,
      credits: {
        ...fakeCredits,
        getBalance: async () => {
          throw new DatabaseError('fetch failed');
        },
      } as unknown as CreditRepository,
      requests: fakeRequests,
      rules: { platformFeePercent: 10, signupBonusCredits: 20, tutorOnboardingBonusCredits: 5 },
      version: 'test',
      allowDevHeader: true,
      logger: false,
    });

    const response = await app3.inject({
      method: 'GET',
      url: '/v1/me/credits',
      headers: { 'x-user-id': DEV_USER },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('DATABASE_UNAVAILABLE');
    await app3.close();
  });
});

describe('rutas inexistentes', () => {
  it('404 con el mismo formato de error', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/nada' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});
