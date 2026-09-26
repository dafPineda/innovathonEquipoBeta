import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { currentUser, parseZod } from '../lib/auth.js';
import type { AppContext } from '../context.js';

const idParamsSchema = z.object({ id: z.uuid('debe ser un UUID válido') });

const bookBodySchema = z.object({
  requestId: z.uuid('debe ser un UUID válido'),
  scheduledAt: z.iso.datetime({ offset: true }).nullish(),
});

const settleBodySchema = z.object({
  minutes: z
    .number('debe ser un número')
    .int('debe ser un número entero de minutos')
    .positive('debe ser mayor que 0')
    .max(24 * 60, 'una sesión no puede durar más de 24 horas'),
});

const cancelBodySchema = z.object({
  reason: z.string().min(3, 'debe tener al menos 3 caracteres').max(500).optional(),
});

const rateBodySchema = z.object({
  rating: z
    .number('debe ser un número')
    .int('debe ser un entero')
    .min(1, 'la calificación mínima es 1')
    .max(5, 'la calificación máxima es 5'),
});

/**
 * Sesiones. Quién hace qué:
 *   agendar → el tutor (toma la solicitud y retiene los créditos del estudiante)
 *   iniciar → cualquiera de los dos
 *   liquidar → cualquiera de los dos (la BD valida participantes)
 *   cancelar → cualquiera de los dos, con penalización si es tarde
 *   calificar → solo el estudiante
 */
export async function sessionRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  app.post('/v1/sessions', { preHandler: ctx.authenticate }, async (request, reply) => {
    const user = currentUser(request);
    const body = parseZod(bookBodySchema, request.body);
    const sessionId = await ctx.credits.bookSession({
      requestId: body.requestId,
      tutorId: user.id,
      scheduledAt: body.scheduledAt ?? null,
    });
    return reply.status(201).send({ sessionId });
  });

  app.post('/v1/sessions/:id/start', { preHandler: ctx.authenticate }, async (request) => {
    const user = currentUser(request);
    const { id } = parseZod(idParamsSchema, request.params);
    const startedAt = await ctx.credits.startSession(id);
    return { sessionId: id, startedAt, requestedBy: user.id };
  });

  app.post('/v1/sessions/:id/settle', { preHandler: ctx.authenticate }, async (request) => {
    const user = currentUser(request);
    const { id } = parseZod(idParamsSchema, request.params);
    const body = parseZod(settleBodySchema, request.body);
    const settlement = await ctx.credits.settleSession({ sessionId: id, minutes: body.minutes, actorId: user.id });
    return { settlement };
  });

  app.post('/v1/sessions/:id/cancel', { preHandler: ctx.authenticate }, async (request) => {
    const user = currentUser(request);
    const { id } = parseZod(idParamsSchema, request.params);
    const body = parseZod(cancelBodySchema, request.body ?? {});
    const cancellation = await ctx.credits.cancelSession({ sessionId: id, actorId: user.id, reason: body.reason });
    return { cancellation };
  });

  app.post('/v1/sessions/:id/rate', { preHandler: ctx.authenticate }, async (request) => {
    const user = currentUser(request);
    const { id } = parseZod(idParamsSchema, request.params);
    const body = parseZod(rateBodySchema, request.body);
    const rating = await ctx.credits.rateSession({ sessionId: id, rating: body.rating, actorId: user.id });
    return { rating };
  });
}
