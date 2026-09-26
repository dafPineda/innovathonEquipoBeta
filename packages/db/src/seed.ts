/**
 * Datos de demo + recorrido completo del flujo de créditos.
 *
 *   pnpm db:seed
 *
 * Crea estudiantes y tutores verificados, y ejecuta de punta a punta:
 * publicar duda → agendar → liquidar → canjear, comprobando después que cada
 * saldo cuadra con lo que dice la liquidación. Si eso funciona, el bookkeeping
 * del dinero está bien. Es el smoke test más barato que existe.
 */
import { formatCredits } from '@beta/credits';
import {
  createAdminClient,
  createCreditRepository,
  createRequestsRepository,
  loadSupabaseEnv,
  type DbClient,
} from '../src/index.js';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234!';
const TUTOR_ONBOARDING_BONUS = 5;

type SeedUser = {
  email: string;
  name: string;
  role: 'student' | 'tutor';
  university: string;
  subjects?: string[];
  creditsPerHour?: number;
  headline?: string;
};

const STUDENTS: SeedUser[] = [
  { email: 'ana@demo.test', name: 'Ana Quispe', role: 'student', university: 'UNMSM' },
  { email: 'bruno@demo.test', name: 'Bruno Salas', role: 'student', university: 'PUCP' },
];

const TUTORS: SeedUser[] = [
  {
    email: 'carla@demo.test',
    name: 'Carla Ríos',
    role: 'tutor',
    university: 'UNI',
    subjects: ['matemáticas', 'física'],
    creditsPerHour: 3,
    headline: '7 años enseñando álgebra y cálculo',
  },
  {
    email: 'diego@demo.test',
    name: 'Diego Mora',
    role: 'tutor',
    university: 'UCLA',
    subjects: ['programación', 'bases de datos'],
    creditsPerHour: 4,
    headline: 'Ingeniero de software, Rust y SQL',
  },
];

async function findExistingUsers(client: DbClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`No se pudieron listar los usuarios: ${error.message}`);
    for (const user of data.users) {
      if (user.email) map.set(user.email, user.id);
    }
    if (data.users.length < 200) break;
  }
  return map;
}

async function ensureUser(
  client: DbClient,
  existing: Map<string, string>,
  seed: SeedUser,
): Promise<string> {
  const known = existing.get(seed.email);
  if (known) return known;

  const { data, error } = await client.auth.admin.createUser({
    email: seed.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: seed.name },
  });
  if (error || !data.user) throw new Error(`No se pudo crear ${seed.email}: ${error?.message}`);
  existing.set(seed.email, data.user.id);
  return data.user.id;
}

/** El trigger profiles_after_insert crea la cuenta y el bono de bienvenida. */
async function ensureProfile(client: DbClient, id: string, seed: SeedUser): Promise<void> {
  const { error } = await client.from('profiles').upsert(
    {
      id,
      role: seed.role,
      display_name: seed.name,
      university: seed.university,
      timezone: 'America/Lima',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw new Error(`No se pudo crear el perfil de ${seed.email}: ${error.message}`);

  if (seed.role !== 'tutor') return;

  const { data: existingTutor } = await client
    .from('tutor_profiles')
    .select('user_id')
    .eq('user_id', id)
    .maybeSingle();

  if (existingTutor) {
    const { error: updateError } = await client
      .from('tutor_profiles')
      .update({ is_verified: true, credits_per_hour: seed.creditsPerHour ?? 3 })
      .eq('user_id', id);
    if (updateError) throw new Error(`No se pudo verificar al tutor: ${updateError.message}`);
  } else {
    const { error: tutorError } = await client.from('tutor_profiles').insert({
      user_id: id,
      headline: seed.headline ?? 'Tutor verificado',
      subjects: seed.subjects ?? ['general'],
      credits_per_hour: seed.creditsPerHour ?? 3,
      is_verified: true,
    });
    if (tutorError) throw new Error(`No se pudo crear el perfil de tutor: ${tutorError.message}`);
  }

  await grantTutorOnboardingBonus(client, id);
}

/** Bono de verificación. Idempotente: solo una vez por tutor. */
async function grantTutorOnboardingBonus(client: DbClient, tutorId: string): Promise<void> {
  const { data: already } = await client
    .from('credit_ledger')
    .select('id')
    .eq('to_user_id', tutorId)
    .eq('reason', 'onboarding_bonus')
    .limit(1)
    .maybeSingle();
  if (already) return;

  const { error } = await client.from('credit_ledger').insert({
    to_user_id: tutorId,
    amount: TUTOR_ONBOARDING_BONUS,
    reason: 'onboarding_bonus',
    metadata: { note: 'Bono de bienvenida al tutor verificado' },
  });
  if (error) throw new Error(`No se pudo dar el bono de tutor: ${error.message}`);
}

type Scenario = {
  studentName: string;
  studentId: string;
  title: string;
  description: string;
  subject: string;
  urgency: 'low' | 'normal' | 'high';
  escrowed: number;
  minutes: number;
};

async function runScenario(
  credits: ReturnType<typeof createCreditRepository>,
  requests: ReturnType<typeof createRequestsRepository>,
  scenario: Scenario,
  tutor: { name: string; id: string },
  step: number,
): Promise<void> {
  const studentBefore = (await credits.getBalance(scenario.studentId)).balance;
  const tutorBefore = (await credits.getBalance(tutor.id)).balance;

  const request = await requests.createRequest({
    studentId: scenario.studentId,
    subject: scenario.subject,
    title: scenario.title,
    description: scenario.description,
    creditsOffered: scenario.escrowed,
    urgency: scenario.urgency,
  });
  console.log(`  ${step}. ${scenario.studentName} publica su duda → ofrece ${formatCredits(scenario.escrowed)}`);

  const sessionId = await credits.bookSession({ requestId: request.id, tutorId: tutor.id });
  console.log(`  ${step + 1}. ${tutor.name} agenda la sesión → la bóveda retiene ${formatCredits(scenario.escrowed)}`);

  await credits.startSession(sessionId);

  const settlement = await credits.settleSession({
    sessionId,
    minutes: scenario.minutes,
    actorId: scenario.studentId,
  });
  console.log(
    `  ${step + 2}. Liquidan ${settlement.duration_minutes} min a ${settlement.rate_per_hour}/h → ` +
      `bruto ${settlement.gross}, comisión ${settlement.platform_fee}, ` +
      `tutor ${settlement.tutor_net}, devuelto ${settlement.refunded}`,
  );

  // ── Invariantes: el dinero ni se crea ni se destruye ──────────────────────
  const studentAfter = (await credits.getBalance(scenario.studentId)).balance;
  const tutorAfter = (await credits.getBalance(tutor.id)).balance;

  assert(
    settlement.gross === settlement.tutor_net + settlement.platform_fee,
    `bruto (${settlement.gross}) ≠ neto (${settlement.tutor_net}) + comisión (${settlement.platform_fee})`,
  );
  assert(
    settlement.gross + settlement.refunded === scenario.escrowed,
    `la bóveda no cuadra: ${settlement.gross} + ${settlement.refunded} ≠ ${scenario.escrowed}`,
  );
  // El estudiante solo pierde lo que se consumió; el sobrante vuelve.
  assert(
    studentAfter === studentBefore - settlement.gross,
    `saldo de ${scenario.studentName}: ${studentBefore} - ${settlement.gross} ≠ ${studentAfter}`,
  );
  // El tutor solo gana su neto; el reembolso va al estudiante, no a él.
  assert(
    tutorAfter === tutorBefore + settlement.tutor_net,
    `saldo de ${tutor.name}: ${tutorBefore} + ${settlement.tutor_net} ≠ ${tutorAfter}`,
  );

  console.log(
    `      ${scenario.studentName}: ${formatCredits(studentBefore)} → ${formatCredits(studentAfter)} · ` +
      `${tutor.name}: ${formatCredits(tutorBefore)} → ${formatCredits(tutorAfter)} ✓`,
  );
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Invariante roto: ${message}`);
}

async function main(): Promise<void> {
  const env = loadSupabaseEnv();
  const client = createAdminClient(env);
  const credits = createCreditRepository(client);
  const requests = createRequestsRepository(client);

  console.log(`▸ Sembrando datos de demo en ${env.url}`);

  const existing = await findExistingUsers(client);
  const ids = new Map<string, string>();

  for (const seed of [...STUDENTS, ...TUTORS]) {
    const id = await ensureUser(client, existing, seed);
    await ensureProfile(client, id, seed);
    ids.set(seed.email, id);
    console.log(`  ✓ ${seed.role.padEnd(7)} ${seed.name.padEnd(14)} ${seed.email}`);
  }

  const idOf = (email: string): string => {
    const id = ids.get(email);
    if (!id) throw new Error(`Falta el usuario de demo ${email}`);
    return id;
  };
  const ana = idOf('ana@demo.test');
  const bruno = idOf('bruno@demo.test');
  const carla = { id: idOf('carla@demo.test'), name: 'Carla' };

  console.log('\n▸ Recorrido: duda → sesión → liquidación → canje\n');

  await runScenario(
    credits,
    requests,
    {
      studentId: ana,
      studentName: 'Ana',
      subject: 'matemáticas',
      title: 'No entiendo estos límites de una derivada',
      description:
        'Con el teorema de la cadena me sale una expresión distinta a la del libro y ya no sé cuál de las dos está mal.',
      urgency: 'high',
      escrowed: 8,
      minutes: 90,
    },
    carla,
    1,
  );

  await runScenario(
    credits,
    requests,
    {
      studentId: bruno,
      studentName: 'Bruno',
      subject: 'matemáticas',
      title: 'Integral por partes, no sé cuándo usarla',
      description:
        'En el ejercicio 4 me piden integrar un producto de tres funciones y no sé si por partes o por cambio de variable.',
      urgency: 'normal',
      escrowed: 5,
      minutes: 60,
    },
    carla,
    6,
  );

  const carlaBalance = (await credits.getBalance(carla.id)).balance;
  console.log('');
  if (carlaBalance >= 10) {
    const redemption = await credits.redeem({ userId: carla.id, credits: 10, method: 'gift_card' });
    const money = (redemption.cash_value_cents / 100).toFixed(2);
    console.log(
      `  9. Carla canjea ${formatCredits(redemption.credits)} → ${money} ${redemption.currency} ` +
        `(código ${redemption.code}, ${redemption.status})`,
    );
  } else {
    console.log(`  9. Carla tiene ${formatCredits(carlaBalance)}: todavía no llega al mínimo de canje (10).`);
    console.log('     Ejecuta pnpm db:seed de nuevo tras otra sesión, o sube el bono de bienvenida.');
  }

  const finalBalance = await credits.getBalance(carla.id);
  console.log(`\n  saldo final de Carla: ${formatCredits(finalBalance.balance)}`);
  console.log(`  ganado en total:     ${formatCredits(finalBalance.lifetime_earned)}`);
  console.log(`  gastado en total:    ${formatCredits(finalBalance.lifetime_spent)}`);

  console.log('\n▸ Cuentas de demo (contraseña: ' + DEMO_PASSWORD + ')');
  console.table([...STUDENTS, ...TUTORS].map((s) => ({ email: s.email, rol: s.role, nombre: s.name })));
  console.log('\n✔ Seed listo. Todos los invariantes de crédito se cumplieron.');
}

main().catch((error: unknown) => {
  console.error('\n✖ Seed falló:', error instanceof Error ? error.message : error);
  process.exit(1);
});
