import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const httpUrl = z.string().min(1).refine((v) => /^https?:\/\//.test(v), {
  message: 'debe ser una URL http(s)',
});

const supabaseEnvSchema = z.object({
  SUPABASE_URL: httpUrl,
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, {
    message: 'Falta SUPABASE_SERVICE_ROLE_KEY (Project settings → API keys)',
  }),
  SUPABASE_ANON_KEY: z.string().optional(),
});

export type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  anonKey?: string;
};

export type SupabaseEnv = SupabaseConfig & {
  /** Reglas de negocio que se pueden ajustar por entorno. */
  rules: {
    platformFeePercent: number;
    signupBonusCredits: number;
    tutorOnboardingBonusCredits: number;
  };
};

let cached: SupabaseEnv | null = null;

/**
 * Lee y valida la configuración de Supabase. Falla ruidosamente al arrancar:
 * es preferible no arrancar que arrancar con la service role equivocada.
 */
export function loadSupabaseEnv(env: NodeJS.ProcessEnv = process.env): SupabaseEnv {
  if (cached) return cached;

  loadDotenv({ quiet: true });

  const parsed = supabaseEnvSchema.safeParse({
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  · ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(
      `Configuración de Supabase inválida.\n${details}\n\n` +
        'Copia .env.example a .env y completa los valores:\n' +
        '  Supabase Dashboard → Project Settings → API',
    );
  }

  cached = {
    url: parsed.data.SUPABASE_URL,
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    ...(parsed.data.SUPABASE_ANON_KEY ? { anonKey: parsed.data.SUPABASE_ANON_KEY } : {}),
    rules: {
      platformFeePercent: intFromEnv(env.PLATFORM_FEE_PERCENT, 10, 'PLATFORM_FEE_PERCENT'),
      signupBonusCredits: intFromEnv(env.SIGNUP_BONUS_CREDITS, 20, 'SIGNUP_BONUS_CREDITS'),
      tutorOnboardingBonusCredits: intFromEnv(env.TUTOR_ONBOARDING_BONUS_CREDITS, 5, 'TUTOR_ONBOARDING_BONUS_CREDITS'),
    },
  };

  return cached;
}

function intFromEnv(raw: string | undefined, fallback: number, field: string): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${field} debe ser un entero >= 0 (recibido: ${raw})`);
  }
  return n;
}

/** Solo para tests: limpia la config cacheada. */
export function resetSupabaseEnvCache(): void {
  cached = null;
}
