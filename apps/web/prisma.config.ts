import { defineConfig } from 'prisma/config';

// Prisma 7 ya no lee .env solo. Los secretos viven en .env.local (regla del proyecto).
try {
  process.loadEnvFile('.env.local');
} catch {
  // en CI/producción las variables llegan por el entorno
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: process.env.DATABASE_URL! },
});
