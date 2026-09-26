import { createAdminClient, createCreditRepository, createRequestsRepository, loadSupabaseEnv } from '@beta/db';
import { loadApiEnv } from './env.js';
import { buildServer } from './server.js';

const VERSION = '0.1.0';

async function main(): Promise<void> {
  const apiEnv = loadApiEnv();
  const supabaseEnv = loadSupabaseEnv();
  const db = createAdminClient(supabaseEnv);

  const app = await buildServer({
    db,
    credits: createCreditRepository(db),
    requests: createRequestsRepository(db),
    rules: supabaseEnv.rules,
    version: VERSION,
    // El atajo `x-user-id` solo existe fuera de producción.
    allowDevHeader: apiEnv.NODE_ENV !== 'production',
    logger: { level: apiEnv.LOG_LEVEL },
  });

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} recibido, cerrando…`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: apiEnv.API_HOST, port: apiEnv.API_PORT });
  app.log.info(
    `intercambio-api v${VERSION} en ${apiEnv.API_HOST}:${apiEnv.API_PORT} ` +
      `(commission ${supabaseEnv.rules.platformFeePercent}%)`,
  );
}

main().catch((error: unknown) => {
  console.error('✖ No se pudo arrancar la API:', error instanceof Error ? error.message : error);
  process.exit(1);
});
