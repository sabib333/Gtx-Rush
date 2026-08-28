/**
 * GTX Rush — Admin API Routes v1.0
 *
 * Central admin router that registers all admin sub-routes.
 * All routes are under /api/admin prefix.
 *
 * SECURITY:
 * - All routes require admin authentication
 * - RBAC permission checks on every endpoint
 * - All sensitive actions are audit logged
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance } from 'fastify';
import { requireAdminAuth } from '../../middleware/admin-auth';
import { adminAuthRoutes } from './auth';
import { adminDashboardRoutes } from './dashboard';
import { adminUserRoutes } from './users';
import { adminGameRoutes } from './games';
import { adminEventRoutes } from './events';
import { adminLeaderboardRoutes } from './leaderboards';
import { adminFraudRoutes } from './fraud';
import { adminModerationRoutes } from './moderation';
import { adminEconomyRoutes } from './economy';
import { adminPaymentRoutes } from './payments';
import { adminAnalyticsRoutes } from './analytics';
import { adminExperimentRoutes } from './experiments';
import { adminFeatureFlagRoutes } from './features';
import { adminEmergencyRoutes } from './emergency';
import { adminAlertRoutes } from './alerts';
import { adminAuditRoutes } from './audit';
import { adminExportRoutes } from './export';
import { adminAIRoutes } from './ai';
import { adminMarketplaceRoutes } from './marketplace';
import { adminLiveOpsRoutes } from './liveops';

export async function adminRoutes(app: FastifyInstance) {
  // Auth routes (no auth required for login)
  await app.register(async (authApp) => {
    await authApp.register(adminAuthRoutes);
  }, { prefix: '/auth' });

  // All other admin routes require authentication
  await app.register(async (protectedApp) => {
    await protectedApp.addHook('onRequest', requireAdminAuth);

    // Dashboard
    await protectedApp.register(adminDashboardRoutes, { prefix: '/dashboard' });

    // User Management
    await protectedApp.register(adminUserRoutes, { prefix: '/users' });

    // Game Management
    await protectedApp.register(adminGameRoutes, { prefix: '/games' });

    // Event Management
    await protectedApp.register(adminEventRoutes, { prefix: '/events' });

    // Leaderboard Operations
    await protectedApp.register(adminLeaderboardRoutes, { prefix: '/leaderboards' });

    // Fraud Center
    await protectedApp.register(adminFraudRoutes, { prefix: '/fraud' });

    // Moderation Center
    await protectedApp.register(adminModerationRoutes, { prefix: '/moderation' });

    // Economy Operations
    await protectedApp.register(adminEconomyRoutes, { prefix: '/economy' });

    // Payment Operations
    await protectedApp.register(adminPaymentRoutes, { prefix: '/payments' });

    // Analytics
    await protectedApp.register(adminAnalyticsRoutes, { prefix: '/analytics' });

    // Experiments (A/B Testing)
    await protectedApp.register(adminExperimentRoutes, { prefix: '/experiments' });

    // Feature Flags
    await protectedApp.register(adminFeatureFlagRoutes, { prefix: '/features' });

    // Emergency Controls
    await protectedApp.register(adminEmergencyRoutes, { prefix: '/emergency' });

    // Alerts
    await protectedApp.register(adminAlertRoutes, { prefix: '/alerts' });

    // Audit Log
    await protectedApp.register(adminAuditRoutes, { prefix: '/audit' });

    // Data Export
    await protectedApp.register(adminExportRoutes, { prefix: '/export' });

    // AI Center (models, review queue, metrics)
    await protectedApp.register(adminAIRoutes, { prefix: '/ai' });

    // Marketplace Management
    await protectedApp.register(adminMarketplaceRoutes, { prefix: '/market' });

    // LiveOps Management
    await protectedApp.register(adminLiveOpsRoutes, { prefix: '/liveops' });
  });
}
