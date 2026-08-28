/**
 * GTX Rush — Retention Scheduler v1.0
 *
 * Handles scheduled operations for the Retention Engine:
 * - Daily mission generation
 * - Mission expiration
 * - Weekly mission rollover
 * - Streak state updates
 * - Reward cleanup
 *
 * IMPORTANT: All operations are idempotent.
 * If a job runs twice, it must not:
 * - Duplicate missions
 * - Duplicate rewards
 * - Corrupt streak state
 *
 * Contract: Retention Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type { ScheduledJobResult } from '@gtx-rush/types';
import { expireMissionsForPeriod } from './mission-engine';
import { getCurrentPeriod, getTodayUTC } from '@gtx-rush/config';

// ============================================================
// Job Registry
// ============================================================

interface ScheduledJob {
  name: string;
  description: string;
  lastRunAt: Date | null;
  intervalMs: number;
  enabled: boolean;
}

const jobs: Map<string, ScheduledJob> = new Map([
  [
    'expire-daily-missions',
    {
      name: 'expire-daily-missions',
      description: 'Expire daily missions at end of day',
      lastRunAt: null,
      intervalMs: 60 * 60 * 1000, // Hourly
      enabled: true,
    },
  ],
  [
    'expire-weekly-missions',
    {
      name: 'expire-weekly-missions',
      description: 'Expire weekly missions at end of week',
      lastRunAt: null,
      intervalMs: 60 * 60 * 1000, // Hourly
      enabled: true,
    },
  ],
  [
    'expire-monthly-missions',
    {
      name: 'expire-monthly-missions',
      description: 'Expire monthly missions at end of month',
      lastRunAt: null,
      intervalMs: 60 * 60 * 1000, // Hourly
      enabled: true,
    },
  ],
  [
    'streak-risk-check',
    {
      name: 'streak-risk-check',
      description: 'Check for users at risk of losing streaks',
      lastRunAt: null,
      intervalMs: 60 * 60 * 1000, // Hourly
      enabled: true,
    },
  ],
  [
    'mission-generation-cleanup',
    {
      name: 'mission-generation-cleanup',
      description: 'Clean up old mission data',
      lastRunAt: null,
      intervalMs: 24 * 60 * 60 * 1000, // Daily
      enabled: true,
    },
  ],
]);

// ============================================================
// Job Implementations
// ============================================================

/**
 * Job: Expire Daily Missions
 * Expires missions from previous days that are still active.
 * Idempotent: Already expired missions are skipped.
 */
function runExpireDailyMissions(): ScheduledJobResult {
  const startTime = new Date();
  const today = getTodayUTC();

  // Get yesterday's period
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayPeriod = yesterday.toISOString().slice(0, 10);

  // Expire yesterday's missions
  const expiredCount = expireMissionsForPeriod(yesterdayPeriod);

  return {
    jobName: 'expire-daily-missions',
    startedAt: startTime,
    completedAt: new Date(),
    success: true,
    details: {
      period: yesterdayPeriod,
      expiredCount,
    },
  };
}

/**
 * Job: Expire Weekly Missions
 * Expires missions from previous weeks that are still active.
 * Idempotent: Already expired missions are skipped.
 */
function runExpireWeeklyMissions(): ScheduledJobResult {
  const startTime = new Date();
  const currentPeriod = getCurrentPeriod('weekly');

  // Get previous week's period
  const lastWeek = new Date();
  lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
  const year = lastWeek.getUTCFullYear();
  const month = String(lastWeek.getUTCMonth() + 1).padStart(2, '0');
  const day = String(lastWeek.getUTCDate()).padStart(2, '0');

  // ISO week calculation for last week
  const d = new Date(Date.UTC(year, lastWeek.getUTCMonth(), lastWeek.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const lastWeekPeriod = `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  // Expire last week's missions if we're in a new week
  let expiredCount = 0;
  if (currentPeriod !== lastWeekPeriod) {
    expiredCount = expireMissionsForPeriod(lastWeekPeriod);
  }

  return {
    jobName: 'expire-weekly-missions',
    startedAt: startTime,
    completedAt: new Date(),
    success: true,
    details: {
      currentPeriod,
      lastWeekPeriod,
      expiredCount,
    },
  };
}

/**
 * Job: Expire Monthly Missions
 * Expires missions from previous months that are still active.
 * Idempotent: Already expired missions are skipped.
 */
function runExpireMonthlyMissions(): ScheduledJobResult {
  const startTime = new Date();
  const currentPeriod = getCurrentPeriod('monthly');

  // Get previous month's period
  const lastMonth = new Date();
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  const lastMonthPeriod = lastMonth.toISOString().slice(0, 7);

  // Expire last month's missions if we're in a new month
  let expiredCount = 0;
  if (currentPeriod !== lastMonthPeriod) {
    expiredCount = expireMissionsForPeriod(lastMonthPeriod);
  }

  return {
    jobName: 'expire-monthly-missions',
    startedAt: startTime,
    completedAt: new Date(),
    success: true,
    details: {
      currentPeriod,
      lastMonthPeriod,
      expiredCount,
    },
  };
}

/**
 * Job: Streak Risk Check
 * Identifies users who are at risk of losing their streak.
 * In production, this would send notifications.
 */
function runStreakRiskCheck(): ScheduledJobResult {
  const startTime = new Date();

  // In production, query users with active streaks
  // and check if they've completed activity today
  const atRiskUsers = 0; // Would be populated from DB

  return {
    jobName: 'streak-risk-check',
    startedAt: startTime,
    completedAt: new Date(),
    success: true,
    details: {
      atRiskUsers,
      checkedAt: new Date().toISOString(),
    },
  };
}

/**
 * Job: Mission Generation Cleanup
 * Removes old mission data to prevent storage bloat.
 * Idempotent: Safe to run multiple times.
 */
function runMissionGenerationCleanup(): ScheduledJobResult {
  const startTime = new Date();

  // In production, this would:
  // 1. Remove expired missions older than 30 days
  // 2. Archive completed missions older than 90 days
  // 3. Compress analytics data older than 1 year

  const cleanedCount = 0; // Would be populated from DB

  return {
    jobName: 'mission-generation-cleanup',
    startedAt: startTime,
    completedAt: new Date(),
    success: true,
    details: {
      cleanedCount,
      cleanupDate: new Date().toISOString(),
    },
  };
}

// ============================================================
// Job Runner
// ============================================================

const jobRunners: Record<string, () => ScheduledJobResult> = {
  'expire-daily-missions': runExpireDailyMissions,
  'expire-weekly-missions': runExpireWeeklyMissions,
  'expire-monthly-missions': runExpireMonthlyMissions,
  'streak-risk-check': runStreakRiskCheck,
  'mission-generation-cleanup': runMissionGenerationCleanup,
};

/**
 * Run all enabled scheduled jobs.
 * Returns results for each job that was executed.
 */
export function runRetentionJobs(): ScheduledJobResult[] {
  const results: ScheduledJobResult[] = [];
  const now = Date.now();

  for (const [name, job] of jobs.entries()) {
    if (!job.enabled) continue;

    // Check if enough time has passed since last run
    if (job.lastRunAt && now - job.lastRunAt.getTime() < job.intervalMs) {
      continue;
    }

    const runner = jobRunners[name];
    if (!runner) continue;

    try {
      const result = runner();
      results.push(result);
      job.lastRunAt = new Date();
    } catch (error) {
      results.push({
        jobName: name,
        startedAt: new Date(),
        completedAt: new Date(),
        success: false,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Run a specific job by name.
 */
export function runRetentionJob(jobName: string): ScheduledJobResult | null {
  const runner = jobRunners[jobName];
  if (!runner) return null;

  try {
    const result = runner();
    const job = jobs.get(jobName);
    if (job) job.lastRunAt = new Date();
    return result;
  } catch (error) {
    return {
      jobName,
      startedAt: new Date(),
      completedAt: new Date(),
      success: false,
      details: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get status of all registered jobs.
 */
export function getRetentionJobStatus(): Array<{
  name: string;
  description: string;
  lastRunAt: Date | null;
  intervalMs: number;
  enabled: boolean;
}> {
  return Array.from(jobs.values()).map((j) => ({
    name: j.name,
    description: j.description,
    lastRunAt: j.lastRunAt,
    intervalMs: j.intervalMs,
    enabled: j.enabled,
  }));
}
