import { positiveCredit, type RedemptionMethod } from '@beta/credits';
import { z } from 'zod';
import type { DbClient } from './client.js';
import { unwrap } from './errors.js';
import type { Balance, LedgerEntry } from './types.js';

/**
 * Repositorio de créditos. Toda la lógica que mueve dinero vive en la BD
 * (funciones SECURITY DEFINER); aquí solo se traducen argumentos y se validan
 * las respuestas. Si una respuesta no cumple el schema, revienta en la border
 * en vez de propagar `undefined` por toda la app.
 */

const balanceSchema = z
  .array(
    z.object({
      balance: z.number(),
      lifetime_earned: z.number(),
      lifetime_spent: z.number(),
    }),
  )
  .min(1);

const EMPTY_BALANCE: Balance = { balance: 0, lifetime_earned: 0, lifetime_spent: 0 };

const historySchema = z.array(
  z.object({
    id: z.number(),
    direction: z.enum(['in', 'out']),
    counterparty: z.string().nullable(),
    amount: z.number(),
    reason: z.enum([
      'signup_bonus',
      'onboarding_bonus',
      'escrow_funded',
      'session_settled',
      'escrow_refunded',
      'redemption',
      'reversal',
      'expired',
      'adjustment',
    ]),
    session_id: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
    created_at: z.string(),
  }),
);

export const settlementSchema = z.object({
  session_id: z.string(),
  duration_minutes: z.number(),
  rate_per_hour: z.number(),
  gross: z.number(),
  platform_fee: z.number(),
  tutor_net: z.number(),
  refunded: z.number(),
  capped_by_escrow: z.boolean(),
  fee_percent: z.number(),
});
export type Settlement = z.infer<typeof settlementSchema>;

export const cancellationSchema = z.object({
  session_id: z.string(),
  refunded: z.number(),
  penalty: z.number(),
  free_cancellation: z.boolean(),
  free_cancellation_hours: z.number(),
});
export type CancellationResult = z.infer<typeof cancellationSchema>;

export const redemptionSchema = z.object({
  redemption_id: z.string(),
  code: z.string(),
  credits: z.number(),
  cash_value_cents: z.number(),
  currency: z.string(),
  method: z.string(),
  status: z.string(),
});
export type RedemptionResult = z.infer<typeof redemptionSchema>;

export const ratingSchema = z.object({
  session_id: z.string(),
  rating: z.number(),
  tutor_rating: z.number().nullable(),
  rating_count: z.number(),
});
export type RatingResult = z.infer<typeof ratingSchema>;

export type BookSessionInput = {
  requestId: string;
  tutorId: string;
  scheduledAt?: string | null;
};

export type CreditRepository = ReturnType<typeof createCreditRepository>;

export function createCreditRepository(client: DbClient) {
  return {
    async getBalance(userId: string): Promise<Balance> {
      const { data, error } = await client.rpc('fn_credit_balance', { p_user: userId });
      const rows = balanceSchema.parse(unwrap({ data, error }));
      const row = rows[0];
      return row ?? EMPTY_BALANCE;
    },

    async getHistory(
      userId: string,
      options: { limit?: number; offset?: number } = {},
    ): Promise<LedgerEntry[]> {
      const { data, error } = await client.rpc('fn_credit_history', {
        p_user: userId,
        p_limit: options.limit ?? 50,
        p_offset: options.offset ?? 0,
      });
      return historySchema.parse(unwrap({ data, error })) as LedgerEntry[];
    },

    /** Agenda una sesión: los créditos del estudiante pasan a la bóveda. */
    async bookSession(input: BookSessionInput): Promise<string> {
      const { data, error } = await client.rpc('fn_book_session', {
        p_request_id: input.requestId,
        p_tutor_id: input.tutorId,
        p_scheduled_at: input.scheduledAt ?? null,
      });
      const sessionId = unwrap<unknown>({ data, error });
      if (typeof sessionId !== 'string') {
        throw new Error(`fn_book_session devolvió ${typeof sessionId} en vez de un id de sesión`);
      }
      return sessionId;
    },

    async startSession(sessionId: string): Promise<string> {
      const { data, error } = await client.rpc('fn_start_session', { p_session_id: sessionId });
      const startedAt = unwrap<unknown>({ data, error });
      return typeof startedAt === 'string' ? startedAt : new Date().toISOString();
    },

    /** Liquida: la bóveda paga al tutor, la comisión se queda la plataforma. */
    async settleSession(input: { sessionId: string; minutes: number; actorId: string }): Promise<Settlement> {
      positiveCredit(input.minutes, 'minutes');
      const { data, error } = await client.rpc('fn_settle_session', {
        p_session_id: input.sessionId,
        p_minutes: Math.round(input.minutes),
        p_actor: input.actorId,
      });
      return settlementSchema.parse(unwrap({ data, error }));
    },

    async cancelSession(input: {
      sessionId: string;
      actorId: string;
      reason?: string;
    }): Promise<CancellationResult> {
      const { data, error } = await client.rpc('fn_cancel_session', {
        p_session_id: input.sessionId,
        p_actor: input.actorId,
        p_reason: input.reason ?? null,
      });
      return cancellationSchema.parse(unwrap({ data, error }));
    },

    async rateSession(input: { sessionId: string; rating: number; actorId: string }): Promise<RatingResult> {
      const { data, error } = await client.rpc('fn_rate_session', {
        p_session_id: input.sessionId,
        p_rating: input.rating,
        p_actor: input.actorId,
      });
      return ratingSchema.parse(unwrap({ data, error }));
    },

    async redeem(input: {
      userId: string;
      credits: number;
      method?: RedemptionMethod;
    }): Promise<RedemptionResult> {
      const credits = positiveCredit(input.credits, 'credits');
      const { data, error } = await client.rpc('fn_redeem_credits', {
        p_user_id: input.userId,
        p_credits: credits,
        p_method: input.method ?? 'gift_card',
      });
      return redemptionSchema.parse(unwrap({ data, error }));
    },
  };
}
