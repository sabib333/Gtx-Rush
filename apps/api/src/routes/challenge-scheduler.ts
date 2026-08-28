/**
 * Challenge Scheduler — API Routes
 *
 * Handles:
 * - GET  /api/challenges/scheduler/status → Get status of all scheduled jobs
 * - POST /api/challenges/scheduler/run    → Manually trigger all scheduled jobs
 * - POST /api/challenges/scheduler/run/:job → Manually trigger a specific job
 *
 * NOTE: In production, these endpoints should be admin-only.
 * For MVP, they're accessible for development and testing.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  runScheduledJobs,
  runJob,
  getJobStatus,
} from '../services/challenge-scheduler';

// ============================================================
// Mock auth helper (admin check in production)
// ============================================================
function getUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (token === 'mock-token' || token.startsWith('dev-')) {
    return 'dev-user-001';
  }

  return 'dev-user-001';
}

// ============================================================
// Routes
// ============================================================

export async function challengeSchedulerRoutes(app: FastifyInstance) {
  /**
   * GET /api/challenges/scheduler/status
   *
   * Get the status of all registered scheduled jobs.
   */
  app.get('/challenges/scheduler/status', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const jobs = getJobStatus();

    return {
      success: true,
      data: {
        jobs: jobs.map((j) => ({
          ...j,
          lastRunAt: j.lastRunAt?.toISOString() ?? null,
        })),
      },
    };
  });

  /**
   * POST /api/challenges/scheduler/run
   *
   * Manually trigger all scheduled jobs.
   * Returns results for each job that was executed.
   */
  app.post('/challenges/scheduler/run', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const results = runScheduledJobs();

    return {
      success: true,
      data: {
        executedJobs: results.length,
        results: results.map((r) => ({
          ...r,
          startedAt: r.startedAt.toISOString(),
          completedAt: r.completedAt.toISOString(),
        })),
      },
    };
  });

  /**
   * POST /api/challenges/scheduler/run/:job
   *
   * Manually trigger a specific job by name.
   */
  app.post('/challenges/scheduler/run/:job', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { job: jobName } = request.params as { job: string };

    const result = runJob(jobName);
    if (!result) {
      return reply.status(404).send({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: `Job "${jobName}" not found` },
      });
    }

    return {
      success: true,
      data: {
        ...result,
        startedAt: result.startedAt.toISOString(),
        completedAt: result.completedAt.toISOString(),
      },
    };
  });
}
