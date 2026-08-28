import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'banned']),
  reason: z.string().max(512).optional(),
});

export const createChallengeSchema = z.object({
  gameId: z.string().uuid(),
  title: z.string().min(1).max(128),
  description: z.string().max(1024),
  rules: z.record(z.unknown()).optional(),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  rewardXp: z.number().int().min(0).max(1000).default(50),
  rewardBadgeId: z.string().uuid().optional(),
});

export const reviewFraudSchema = z.object({
  status: z.enum(['confirmed', 'dismissed']),
  notes: z.string().max(1024).optional(),
});

export const createBadgeSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(128),
  description: z.string().max(512),
  iconUrl: z.string().url(),
  category: z.string().max(32),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
  criteria: z.record(z.unknown()),
});

export const createCosmeticSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(128),
  description: z.string().max(512),
  category: z.enum(['avatar_frame', 'profile_bg', 'title', 'effect', 'emoji_pack']),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
  priceStars: z.number().int().min(1),
  assetUrl: z.string().url(),
});
