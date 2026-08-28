import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  bio: z.string().max(256).optional(),
  settings: z
    .object({
      notifications: z.boolean().optional(),
      soundEnabled: z.boolean().optional(),
      hapticEnabled: z.boolean().optional(),
      analyticsOptOut: z.boolean().optional(),
    })
    .optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});
