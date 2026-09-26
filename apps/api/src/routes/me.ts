import { z } from 'zod';
import { currentUser, parseZod } from '../lib/auth.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1, 'mínimo: 1').max(200, 'máximo: 200').default(50),
  offset: z.coerce.number().int().min(0, 'no puede ser negativo').default(0),
});

const redeemBodySchema = z.object({
  credits: z
    .number('debe ser un número')
    .int('los créditos son enteros: no se admiten decimales')
    .positive('debe ser mayor que 0')
    .max(100_000, 'el canje máximo es de 100000 créditos'),
  method: z.enum(['gift_card', 'bank_transfer', 'platform_wallet', 'discount']).default('gift_card'),
});

const createRequestSchema = z.object({
  subject: z.string().min(2, 'la materia necesita al menos 2 caracteres').max(60),
  title: z.string().min(8, 'el título necesita al menos 8 caracteres').max(120),
  description: z
    .string()
    .min(20, 'describe tu duda con al menos 20 caracteres')
    .max(4000, 'admite hasta 4000 caracteres'),
  creditsOffered: z
    .number('debe ser un número')
    .int('debe ser un entero')
    .min(1, 'ofrece al menos 1 crédito')
    .max(500, 'el máximo por solicitud es 500 créditos'),
  urgency: z.enum(['low', 'normal', 'high']).default('normal'),
});

export async function meRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  /** GET /v1/me/credits · saldo del usuario del token. */
  app.get('/v1/me/credits', { preHandler: ctx.authenticate }, async (request) => {
    const user = currentUser(request);
    return { userId: user.id, ...(await ctx.credits.getBalance(user.id)) };
  });

  /** GET /v1/me/credits/history · movimientos del usuario del token. */
  app.get('/v1/me/credits/history', { preHandler: ctx.authenticate }, async (request) => {
    const user = currentUser(request);
    const query = parseZod(historyQuerySchema, request.query);
    return { entries: await ctx.credits.getHistory(user.id, query) };
  });

  /** POST /v1/me/credits/redeem · canjea créditos por dinero simbólico. */
  app.post('/v1/me/credits/redeem', { preHandler: ctx.authenticate }, async (request, reply) => {
    const user = currentUser(request);
    const body = parseZod(redeemBodySchema, request.body);
    const redemption = await ctx.credits.redeem({ userId: user.id, ...body });
    return reply.status(201).send({ redemption });
  });

  /** POST /v1/requests · publica una duda (quien publica, aporta los créditos). */
  app.post('/v1/requests', { preHandler: ctx.authenticate }, async (request, reply) => {
    const user = currentUser(request);
    const body = parseZod(createRequestSchema, request.body);
    const created = await ctx.requests.createRequest({ studentId: user.id, ...body });
    return reply.status(201).send({ request: created });
  });

  /** GET /v1/me/profile */
  app.get('/v1/me/profile', { preHandler: ctx.authenticate }, async (request) => {
    const user = currentUser(request);
    const profile = await ctx.requests.getProfile(user.id);
    return { profile };
  });
}
