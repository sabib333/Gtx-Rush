import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SocialFeedService } from '../social-feed';
import { db } from '../../db/index';

// Mock dependencies
vi.mock('../../db/index', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    $count: vi.fn().mockResolvedValue(0),
  },
}));

describe('SocialFeedService', () => {
  let service: SocialFeedService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SocialFeedService();
  });

  describe('Feed Events', () => {
    it('should create feed event', async () => {
      const mockEvent = {
        id: 'feed-1',
        eventType: 'LEVEL_UP' as const,
        userId: 'user-1',
        metadata: { level: 20 },
        createdAt: new Date(),
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockEvent]),
        }),
      });

      const result = await service.createFeedEvent({
        eventType: 'LEVEL_UP',
        userId: 'user-1',
        metadata: { level: 20 },
      });

      expect(result).toBeDefined();
    });

    it('should get feed events', async () => {
      const mockEvents = [
        { id: 'feed-1', eventType: 'LEVEL_UP', userId: 'user-1' },
        { id: 'feed-2', eventType: 'ACHIEVEMENT_UNLOCKED', userId: 'user-2' },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        }),
      });

      const result = await service.getFeedEvents({ limit: 10 });

      expect(result).toEqual(mockEvents);
    });
  });

  describe('Reactions', () => {
    it('should add reaction to feed event', async () => {
      const mockReaction = {
        id: 'reaction-1',
        feedEventId: 'feed-1',
        userId: 'user-1',
        emoji: '🔥',
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockReaction]),
          }),
        }),
      });

      const result = await service.addReaction({
        feedEventId: 'feed-1',
        userId: 'user-1',
        emoji: '🔥',
      });

      expect(result).toBeDefined();
    });

    it('should remove reaction', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await service.removeReaction('feed-1', 'user-1', '🔥');

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('Reports', () => {
    it('should create report', async () => {
      const mockReport = {
        id: 'report-1',
        reporterId: 'user-1',
        reportedUserId: 'user-2',
        reason: 'SPAM',
        description: 'Posting too much',
        status: 'PENDING',
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockReport]),
        }),
      });

      const result = await service.createReport({
        reporterId: 'user-1',
        reportedUserId: 'user-2',
        reason: 'SPAM',
        description: 'Posting too much',
      });

      expect(result).toBeDefined();
    });
  });
});
