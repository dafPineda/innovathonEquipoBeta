import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseZod } from '../lib/auth.js';
import type { AppContext } from '../context.js';

const querySchema = z.object({
  subject: z.string().min(2, 'la materia necesita al menos 2 caracteres').max(60).optional(),
  limit: z.coerce.number().int().min(1, 'mínimo: 1').max(100, 'máximo: 100').default(25),
});

/** GET /health · sin autenticación: lo usan despliegues y monitors. */
export async function healthRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  app.get('/health', async () => {
    let dbOk = false;
    try {
      const { error } = await ctx.db.from('app_config').select('key').limit(1);
      dbOk = !error;
    } catch {
      dbOk = false;
    }
    return {
      ok: dbOk,
      service: 'intercambio-api',
      version: ctx.version,
      database: { reachable: dbOk },
      rules: ctx.rules,
    };
  });

  /** GET /v1/requests · solicitudes abiertas (el mercado). */
  app.get('/v1/requests', { preHandler: ctx.authenticate }, async (request) => {
    const query = parseZod(querySchema, request.query);
    return { requests: await ctx.requests.listOpenRequests(query) };
  });

  /** GET /v1/tutors · directorio de tutores verificados. */
  app.get('/v1/tutors', { preHandler: ctx.authenticate }, async (request) => {
    const query = parseZod(querySchema, request.query);
    return { tutors: await ctx.requests.listTutors(query) };
  });
}
