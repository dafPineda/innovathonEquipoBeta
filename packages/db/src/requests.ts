import { positiveCredit } from '@beta/credits';
import { z } from 'zod';
import type { DbClient } from './client.js';
import { mapDbError, unwrap } from './errors.js';
import type { OpenRequest, Profile, RequestUrgency, TutorSummary } from './types.js';

export const createRequestSchema = z.object({
  studentId: z.string().uuid(),
  subject: z.string().min(2).max(60),
  title: z.string().min(8).max(120),
  description: z.string().min(20).max(4000),
  creditsOffered: positiveCredit,
  urgency: z.enum(['low', 'normal', 'high']).default('normal'),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

const openRequestsSchema = z.array(
  z.object({
    id: z.string(),
    student_id: z.string(),
    student_name: z.string(),
    subject: z.string(),
    title: z.string(),
    description: z.string(),
    urgency: z.enum(['low', 'normal', 'high']),
    credits_offered: z.number(),
    created_at: z.string(),
  }),
);

const tutorDirectorySchema = z.array(
  z.object({
    user_id: z.string(),
    display_name: z.string(),
    headline: z.string().nullable(),
    subjects: z.array(z.string()),
    credits_per_hour: z.number(),
    rating: z.number().nullable(),
    sessions_completed: z.number(),
  }),
);

const profileSchema = z.object({
  id: z.string(),
  role: z.enum(['student', 'tutor', 'admin']),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  university: z.string().nullable(),
  timezone: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type RequestsRepository = ReturnType<typeof createRequestsRepository>;

export function createRequestsRepository(client: DbClient) {
  return {
    /** Publica una duda. Los créditos se retienen al agendar, no al publicar. */
    async createRequest(input: CreateRequestInput) {
      const parsed = createRequestSchema.parse(input);
      const { data, error } = await client
        .from('help_requests')
        .insert({
          student_id: parsed.studentId,
          subject: parsed.subject,
          title: parsed.title,
          description: parsed.description,
          credits_offered: parsed.creditsOffered,
          urgency: parsed.urgency as RequestUrgency,
        })
        .select('id, status, credits_offered, created_at')
        .single();

      if (error) throw mapDbError(error, 'No se pudo crear la solicitud');
      return data as { id: string; status: string; credits_offered: number; created_at: string };
    },

    async listOpenRequests(options: { subject?: string; limit?: number } = {}): Promise<OpenRequest[]> {
      const { data, error } = await client.rpc('fn_open_requests', {
        p_subject: options.subject ?? null,
        p_limit: options.limit ?? 25,
      });
      if (error) throw mapDbError(error, 'No se pudieron listar las solicitudes');
      return openRequestsSchema.parse(data) as OpenRequest[];
    },

    async listTutors(options: { subject?: string; limit?: number } = {}): Promise<TutorSummary[]> {
      const { data, error } = await client.rpc('fn_tutor_directory', {
        p_subject: options.subject ?? null,
        p_limit: options.limit ?? 25,
      });
      if (error) throw mapDbError(error, 'No se pudo listar el directorio de tutores');
      return tutorDirectorySchema.parse(data) as TutorSummary[];
    },

    async getProfile(userId: string): Promise<Profile | null> {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw mapDbError(error, 'No se pudo leer el perfil');
      if (!data) return null;
      return profileSchema.parse(data) as Profile;
    },
  };
}
