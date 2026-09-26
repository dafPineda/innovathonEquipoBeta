/**
 * Aplica las migraciones SQL en orden.
 *
 * En un proyecto Supabase alojado no hay `supabase db push` sin la CLI, así que
 * usamos la función `exec_sql`. Créala UNA vez en Supabase Studio → SQL Editor:
 *
 *   create or replace function public.exec_sql(sql text)
 *   returns void language plpgsql security definer as $$
 *   begin execute sql; end $$;
 *   revoke execute on function public.exec_sql(text) from public, anon, authenticated;
 *
 * Uso: pnpm db:migrate
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminClient, loadSupabaseEnv } from '../src/index.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');

const BOOTSTRAP_SQL = `create or replace function public.exec_sql(sql text)
returns void language plpgsql security definer as $fn$
begin execute sql; end
$fn$;

revoke execute on function public.exec_sql(text) from public, anon, authenticated;`;

async function main(): Promise<void> {
  const env = loadSupabaseEnv();
  const client = createAdminClient(env);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error('No hay migraciones en', MIGRATIONS_DIR);
    process.exit(1);
  }

  console.log(`▸ Aplicando ${files.length} migraciones en ${env.url}\n`);

  for (const [index, file] of files.entries()) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const { error } = await client.rpc('exec_sql', { sql });

    if (error) {
      // Si ni la primera migración pasa, casi seguro es que falta exec_sql.
      if (index === 0 && /exec_sql|does not exist/i.test(error.message)) {
        console.error('✖ Falta la función exec_sql. Crea esta en Supabase Studio → SQL Editor:\n');
        console.error(BOOTSTRAP_SQL);
        console.error('\nO instala la CLI:  npx supabase@latest init && npx supabase@latest db push');
        process.exit(1);
      }
      console.error(`✖ ${file}\n  ${error.message}`);
      process.exit(1);
    }
    console.log(`  ✓ ${file}`);
  }

  console.log('\n✔ Migraciones aplicadas.');
  console.log('  Siguiente paso:  pnpm db:seed');
}

main().catch((error: unknown) => {
  console.error('✖', error instanceof Error ? error.message : error);
  process.exit(1);
});
