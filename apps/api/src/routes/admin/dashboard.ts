/**
 * GTX Rush — Admin Dashboard Routes v1.0
 *
 * Provides dashboard statistics, system status, and real-time operational data.
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission } from '../../middleware/admin-auth';
import { adminAuditLog, killSwitches } from '../../middleware/admin-auth';

// ============================================================
// Mock data aggregations (production: read from analytics DB / cache)
// ============================================================

function getDashboardStats() {
  return {
    dau: 12500,
    wau: 45000,
    mau: 180000,
    newUsers: 850,
    returningUsers: 11650,
    gamesPlayed: 58000,
    challenges: 12400,
    activeEvents: 3,
    revenue: 4250.00,
    starsPurchases: 1280,
    adRevenue: 1890.00,
    reports: 42,
    fraudAlerts: 7,
  };
}

function getSystemStatus() {
  return {
    api: {
      name: 'API',
      status: 'healthy' as const,
      lastChecked: new Date(),
      latencyMs: 12,
      message: null,
    },
    database: {
      name: 'Database',
      status: 'healthy' as const,
      lastChecked: new Date(),
      latencyMs: 5,
      message: null,
    },
    cache: {
      name: 'Cache',
      status: 'healthy' as const,
      lastChecked: new Date(),
      latencyMs: 1,
      message: null,
    },
    queue: {
      name: 'Queue',
      status: 'healthy' as const,
      lastChecked: new Date(),
      latencyMs: 3,
      message: null,
    },
    payments: {
      name: 'Payments',
      status: 'healthy' as const,
      lastChecked: new Date(),
      latencyMs: 45,
      message: null,
    },
    analytics: {
      name: 'Analytics',
      status: 'healthy' as const,
      lastChecked: new Date(),
      latencyMs: 8,
      message: null,
    },
    gameServices: {
      name: 'Game Services',
      status: 'healthy' as const,
      lastChecked: new Date(),
      latencyMs: 15,
      message: null,
    },
  };
}

function getRecentActivity() {
  const recentAudits = adminAuditLog.slice(-20).reverse().map((entry) => ({
    id: entry.id,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    adminUserId: entry.adminUserId,
    timestamp: entry.createdAt,
  }));

  return recentAudits.length > 0 ? recentAudits : [
    { id: '1', action: 'SYSTEM_INIT', targetType: 'system', targetId: null, adminUserId: 'system', timestamp: new Date() },
  ];
}

export async function adminDashboardRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/dashboard/stats
   * Get main dashboard statistics
   */
  app.get('/stats', {
    preHandler: [requirePermission('dashboard.view')],
  }, async () => {
    return {
      success: true,
      data: getDashboardStats(),
    };
  });

  /**
   * GET /api/admin/dashboard/system-status
   * Get operational system status
   */
  app.get('/system-status', {
    preHandler: [requirePermission('dashboard.realtime_status')],
  }, async () => {
    return {
      success: true,
      data: getSystemStatus(),
    };
  });

  /**
   * GET /api/admin/dashboard/activity
   * Get recent admin activity
   */
  app.get('/activity', {
    preHandler: [requirePermission('dashboard.view')],
  }, async () => {
    return {
      success: true,
      data: getRecentActivity(),
    };
  });

  /**
   * GET /api/admin/dashboard/kill-switches
   * Get status of emergency kill switches
   */
  app.get('/kill-switches', {
    preHandler: [requirePermission('emergency.view')],
  }, async () => {
    const switches = {
      disable_payments: killSwitches.get('disable_payments') ?? false,
      disable_creator_publishing: killSwitches.get('disable_creator_publishing') ?? false,
      disable_rewards: killSwitches.get('disable_rewards') ?? false,
      disable_event_participation: killSwitches.get('disable_event_participation') ?? false,
    };

    return {
      success: true,
      data: switches,
    };
  });

  /**
   * GET /api/admin/dashboard/overview
   * Combined overview for the command center
   */
  app.get('/overview', {
    preHandler: [requirePermission('dashboard.view')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const adminUser = (request as FastifyRequest & { adminUser?: { role: string } }).adminUser;
    const canViewStatus = adminUser?.role === 'super_admin' || adminUser?.role === 'ops_admin';

    return {
      success: true,
      data: {
        stats: getDashboardStats(),
        systemStatus: canViewStatus ? getSystemStatus() : null,
        killSwitches: {
          disable_payments: killSwitches.get('disable_payments') ?? false,
          disable_creator_publishing: killSwitches.get('disable_creator_publishing') ?? false,
          disable_rewards: killSwitches.get('disable_rewards') ?? false,
          disable_event_participation: killSwitches.get('disable_event_participation') ?? false,
        },
        recentActivity: getRecentActivity(),
      },
    };
  });
}
