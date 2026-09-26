import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseConfig } from './env.js';

export type DbClient = SupabaseClient;

/**
 * Cliente con service role: ignora RLS a propósito. Solo debe existir dentro
 * del backend. Nunca lo instancies en código que corra en el navegador.
 */
export function createAdminClient(config: SupabaseConfig): DbClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-application-name': 'intercambio-api' } },
  });
}

/**
 * Cliente "público": respeta RLS, para el futuro frontend.
 * Úsalo solo si necesitas leer desde el servidor como un usuario concreto.
 */
export function createPublicClient(config: SupabaseConfig): DbClient {
  if (!config.anonKey) {
    throw new Error('Falta SUPABASE_ANON_KEY para el cliente público');
  }
  return createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
