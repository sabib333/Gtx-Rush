import { z } from 'zod';

export const authVerifySchema = z.object({
  initData: z.string().min(1, 'initData is required'),
});

export const jwtPayloadSchema = z.object({
  userId: z.string().uuid(),
  telegramId: z.number().int().positive(),
  iat: z.number(),
  exp: z.number(),
});

export const adminJwtPayloadSchema = jwtPayloadSchema.extend({
  role: z.enum(['super_admin', 'admin', 'moderator', 'viewer']),
  permissions: z.array(z.string()),
});
