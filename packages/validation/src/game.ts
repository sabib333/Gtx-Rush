import { z } from 'zod';

export const gameSlugParamSchema = z.object({
  slug: z.string().min(1).max(64),
});

export const startSessionSchema = z.object({
  gameId: z.string().uuid(),
  clientSessionToken: z.string().min(1).max(128),
});

export const submitInputSchema = z.object({
  sequence: z.number().int().min(0),
  timestamp: z.number().int().positive(),
  type: z.string().min(1).max(64),
  data: z.record(z.unknown()),
});

export const finishSessionSchema = z.object({
  clientCalculatedScore: z.number().int().min(0),
});
