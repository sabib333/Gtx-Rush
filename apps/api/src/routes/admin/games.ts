/**
 * GTX Rush — Admin Game Management Routes v1.0
 *
 * Handles game enable/disable/maintenance, configuration, and versioning.
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';

interface GameConfig {
  id: string;
  slug: string;
  name: string;
  status: 'enabled' | 'disabled' | 'maintenance';
  config: Record<string, unknown>;
  currentVersion: number;
  lastConfigChange: Date | null;
}

const gameConfigs: GameConfig[] = [
  {
    id: 'game-reaction-rush', slug: 'reaction-rush', name: 'Reaction Rush',
    status: 'enabled',
    config: { rounds: 5, duration: 30000, difficulty: 'normal', cooldown: 60000 },
    currentVersion: 3, lastConfigChange: new Date('2024-08-01'),
  },
  {
    id: 'game-tap-rush', slug: 'tap-rush', name: 'Tap Rush',
    status: 'enabled',
    config: { duration: 10000, targetTaps: 100, difficulty: 'normal', cooldown: 60000 },
    currentVersion: 2, lastConfigChange: new Date('2024-07-15'),
  },
  {
    id: 'game-quiz-rush', slug: 'quiz-rush', name: 'Quiz Rush',
    status: 'enabled',
    config: { questions: 10, timePerQuestion: 15000, difficulty: 'normal', cooldown: 60000 },
    currentVersion: 1, lastConfigChange: new Date('2024-07-01'),
  },
];

const configHistory: Array<{
  gameId: string; version: number; config: Record<string, unknown>;
  authorId: string; reason: string; status: string; createdAt: Date;
}> = [];

export async function adminGameRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/games
   * List all games with operational status
   */
  app.get('/', {
    preHandler: [requirePermission('games.view')],
  }, async () => {
    return { success: true, data: gameConfigs };
  });

  /**
   * GET /api/admin/games/:id
   * Get detailed game configuration
   */
  app.get('/:id', {
    preHandler: [requirePermission('games.view')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const game = gameConfigs.find((g) => g.id === id || g.slug === id);
    if (!game) {
      return reply.status(404).send({
        success: false, error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
      });
    }
    return { success: true, data: game };
  });

  /**
   * POST /api/admin/games/:id/status
   * Update game operational status
   */
  app.post('/:id/status', {
    preHandler: [requirePermission('games.enable')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { status, reason } = request.body as { status?: string; reason?: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!status || !['enabled', 'disabled', 'maintenance'].includes(status)) {
      return reply.status(400).send({
        success: false, error: { code: 'INVALID_STATUS', message: 'Status must be enabled, disabled, or maintenance' },
      });
    }

    const game = gameConfigs.find((g) => g.id === id || g.slug === id);
    if (!game) {
      return reply.status(404).send({
        success: false, error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
      });
    }

    const beforeState = { status: game.status };
    game.status = status as GameConfig['status'];
    game.lastConfigChange = new Date();

    const action = status === 'enabled' ? 'GAME_ENABLED' : status === 'disabled' ? 'GAME_DISABLED' : 'GAME_MAINTENANCE';
    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action,
      targetType: 'game',
      targetId: id,
      beforeState,
      afterState: { status: game.status },
      reason: reason ?? `Game status changed to ${status}`,
      metadata: { gameSlug: game.slug },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: `Game status updated to ${status}`, game } };
  });

  /**
   * POST /api/admin/games/:id/config
   * Update game configuration (creates version)
   */
  app.post('/:id/config', {
    preHandler: [requirePermission('games.configure')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { config, reason } = request.body as { config?: Record<string, unknown>; reason?: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!config) {
      return reply.status(400).send({
        success: false, error: { code: 'MISSING_CONFIG', message: 'Configuration is required' },
      });
    }

    const game = gameConfigs.find((g) => g.id === id || g.slug === id);
    if (!game) {
      return reply.status(404).send({
        success: false, error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
      });
    }

    // Save previous config as version
    configHistory.push({
      gameId: game.id,
      version: game.currentVersion,
      config: { ...game.config },
      authorId: adminUser?.id ?? 'unknown',
      reason: reason ?? 'Configuration updated',
      status: 'active',
      createdAt: new Date(),
    });

    const beforeState = { config: { ...game.config }, version: game.currentVersion };
    game.config = config;
    game.currentVersion++;
    game.lastConfigChange = new Date();

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'CONFIG_CHANGED',
      targetType: 'game',
      targetId: id,
      beforeState,
      afterState: { config: game.config, version: game.currentVersion },
      reason: reason ?? 'Game configuration updated',
      metadata: { gameSlug: game.slug, newVersion: game.currentVersion },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return {
      success: true,
      data: { message: 'Configuration updated', game, newVersion: game.currentVersion },
    };
  });

  /**
   * GET /api/admin/games/:id/versions
   * Get configuration version history
   */
  app.get('/:id/versions', {
    preHandler: [requirePermission('games.view_config_versions')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const game = gameConfigs.find((g) => g.id === id || g.slug === id);
    if (!game) {
      return reply.status(404).send({
        success: false, error: { code: 'GAME_NOT_FOUND', message: 'Game not found' },
      });
    }

    const versions = configHistory
      .filter((h) => h.gameId === game.id)
      .sort((a, b) => b.version - a.version);

    return {
      success: true,
      data: {
        gameId: game.id,
        currentVersion: game.currentVersion,
        versions,
      },
    };
  });
}
