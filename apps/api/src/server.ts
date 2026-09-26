import { CreditError } from '@beta/credits';
import { DatabaseError } from '@beta/db';
import type { AppContext } from './context.js';
import { createAuthenticator } from './lib/auth.js';
import { creditErrorToHttp } from './lib/errors.js';
import { meRoutes } from './routes/me.js';
import { healthRoutes } from './routes/public.js';
import { sessionRoutes } from './routes/sessions.js';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { zodToError } from './lib/errors.js';

export type BuildServerOptions = Omit<AppContext, 'authenticate'> & {
  allowDevHeader: boolean;
  logger?: boolean | { level: string };
};

export async function buildServer(opts: BuildServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? { level: 'info' },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    allowedHeaders: ['authorization', 'content-type', 'x-user-id'],
  });

  const ctx: AppContext = {
    db: opts.db,
    credits: opts.credits,
    requests: opts.requests,
    authenticate: createAuthenticator(opts.db, { allowDevHeader: opts.allowDevHeader }),
    rules: opts.rules,
    version: opts.version,
  };

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof CreditError) {
      const { status, body } = creditErrorToHttp(error);
      return reply.status(status).send(body);
    }
    if (error instanceof DatabaseError) {
      request.log.error({ err: error }, 'base de datos no disponible');
      return reply.status(503).send({ error: error.toJSON() });
    }
    if (error instanceof ZodError) {
      const { status, body } = creditErrorToHttp(zodToError(error));
      return reply.status(status).send(body);
    }

    const httpError = error as { statusCode?: number; message?: string } | null;
    if (httpError && typeof httpError.statusCode === 'number' && httpError.statusCode < 500) {
      return reply.status(httpError.statusCode).send({
        error: { code: 'BAD_REQUEST', message: httpError.message ?? 'Petición inválida' },
      });
    }

    request.log.error({ err: error }, 'error no controlado');
    return reply.status(500).send({
      error: { code: 'INTERNAL', message: 'Error interno del servidor' },
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `No existe ${request.method} ${request.url}` },
    }),
  );

  await healthRoutes(app, ctx);
  await meRoutes(app, ctx);
  await sessionRoutes(app, ctx);

  return app;
}
