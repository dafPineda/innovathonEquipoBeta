/**
 * Tipos de fila. Deliberadamente escritos a mano para el demo: cuando
 * conectes la CLI de Supabase (`pnpm db:types`), reemplaza este archivo por el
 * `database.types.ts` generado y borrarás de un golpe todos los `as` de los
 * repositorios.
 */

export type UserRole = 'student' | 'tutor' | 'admin';

export type RequestStatus = 'open' | 'in_session' | 'resolved' | 'closed' | 'cancelled';
export type RequestUrgency = 'low' | 'normal' | 'high';
export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
export type EscrowStatus = 'held' | 'settled' | 'refunded';
export type RedemptionStatus = 'pending' | 'fulfilled' | 'rejected';
export type RedemptionMethod = 'gift_card' | 'bank_transfer' | 'platform_wallet' | 'discount';

export type CreditReason =
  | 'signup_bonus'
  | 'onboarding_bonus'
  | 'escrow_funded'
  | 'session_settled'
  | 'escrow_refunded'
  | 'redemption'
  | 'reversal'
  | 'expired'
  | 'adjustment';

export type Profile = {
  id: string;
  role: UserRole;
  display_name: string;
  avatar_url: string | null;
  university: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type TutorProfile = {
  user_id: string;
  headline: string | null;
  subjects: string[];
  bio: string | null;
  credits_per_hour: number;
  is_verified: boolean;
  rating: number | null;
  rating_count: number;
  sessions_completed: number;
  created_at: string;
  updated_at: string;
};

export type CreditAccount = {
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  updated_at: string;
};

export type LedgerEntry = {
  id: number;
  direction: 'in' | 'out';
  counterparty: string | null;
  amount: number;
  reason: CreditReason;
  session_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type HelpRequest = {
  id: string;
  student_id: string;
  tutor_id: string | null;
  subject: string;
  title: string;
  description: string;
  urgency: RequestUrgency;
  status: RequestStatus;
  credits_offered: number;
  created_at: string;
  updated_at: string;
};

export type OpenRequest = {
  id: string;
  student_id: string;
  student_name: string;
  subject: string;
  title: string;
  description: string;
  urgency: RequestUrgency;
  credits_offered: number;
  created_at: string;
};

export type TutorSummary = {
  user_id: string;
  display_name: string;
  headline: string | null;
  subjects: string[];
  credits_per_hour: number;
  rating: number | null;
  sessions_completed: number;
};

export type Session = {
  id: string;
  request_id: string;
  student_id: string;
  tutor_id: string;
  status: SessionStatus;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  credits_gross: number | null;
  credits_paid: number | null;
  platform_fee: number | null;
  rating: number | null;
  created_at: string;
};

export type Redemption = {
  id: string;
  user_id: string;
  credits: number;
  cash_value_cents: number;
  currency: string;
  method: RedemptionMethod;
  status: RedemptionStatus;
  redemption_code: string | null;
  created_at: string;
  fulfilled_at: string | null;
};

export type Balance = {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
};
