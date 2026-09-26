import type { CreditRepository, DbClient, RequestsRepository } from '@beta/db';
import type { FastifyReply, FastifyRequest } from 'fastify';

export type Authenticate = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export type AppRules = {
  platformFeePercent: number;
  signupBonusCredits: number;
  tutorOnboardingBonusCredits: number;
};

export type AppContext = {
  db: DbClient;
  credits: CreditRepository;
  requests: RequestsRepository;
  authenticate: Authenticate;
  rules: AppRules;
  version: string;
};
