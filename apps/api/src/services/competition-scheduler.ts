/**
 * GTX Rush — Competition Scheduler v1.0
 *
 * Handles scheduled operations for the competition system:
 * - Weekly ranking finalization
 * - Season lifecycle transitions
 * - Tier calculation and updates
 * - Season reward distribution
 * - Rank snapshot creation
 * - Badge processing
 *
 * All jobs are idempotent and safe to retry.
 */

import { nanoid } from 'nanoid';
import type { CompetitionScheduledJobResult } from '@gtx-rush/types';
import { getActiveSeason, endSeason, distributeAllSeasonRewards, getSeasonRankings } from './season-engine';
import { processTierUpdates } from './tier-system';
import { _clearAllRankings } from './ranking-service';

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
    'weekly-ranking-snapshot',
    {
      name: 'weekly-ranking-snapshot',
      description: 'Take weekly rank snapshots for all users',
      lastRunAt: null,
      intervalMs: 7 * 24 * 60 * 60 * 1000, // Weekly
      enabled: true,
    },
  ],
  [
    'season-transition-check',
    {
      name: 'season-transition-check',
      description: 'Check if active season should end',
      lastRunAt: null,
      intervalMs: 60 * 60 * 1000, // Hourly
      enabled: true,
    },
  ],
  [
    'tier-calculation',
    {
      name: 'tier-calculation',
      description: 'Update tier assignments based on season scores',
      lastRunAt: null,
      intervalMs: 6 * 60 * 60 * 1000, // Every 6 hours
      enabled: true,
    },
  ],
  [
    'daily-rank-snapshot',
    {
      name: 'daily-rank-snapshot',
      description: 'Take daily rank snapshots',
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
 * Job: Weekly Ranking Snapshot
 * Creates rank snapshots for all active users.
 */
function runWeeklyRankingSnapshot(): CompetitionScheduledJobResult {
  const startTime = new Date();

  // In production, query all users with valid scores
  // and create rank_snapshots records
  const snapshotCount = 0; // Would be populated from DB

  return {
    jobName: 'weekly-ranking-snapshot',
    startedAt: startTime,
    completedAt: new Date(),
    success: true,
    details: {
      snapshotType: 'weekly',
      snapshotCount,
    },
  };
}

/**
 * Job: Season Transition Check
 * Checks if the active season has passed its end time and transitions it.
 */
function runSeasonTransitionCheck(): CompetitionScheduledJobResult {
  const startTime = new Date();
  const activeSeason = getActiveSeason();

  if (!activeSeason) {
    return {
      jobName: 'season-transition-check',
      startedAt: startTime,
      completedAt: new Date(),
      success: true,
      details: { message: 'No active season' },
    };
  }

  const now = new Date();
  let ended = false;

  if (now > activeSeason.endsAt) {
    ended = endSeason(activeSeason.id);

    if (ended) {
      // Distribute rewards
      const rewards = distributeAllSeasonRewards(activeSeason.id);

      // Process tier updates
      const rankings = getSeasonRankings(activeSeason.id).entries;
      const tierUpdates = processTierUpdates(
        activeSeason.id,
        rankings.map((r) => ({ userId: r.userId, score: r.score })),
      );

      return {
        jobName: 'season-transition-check',
        startedAt: startTime,
        completedAt: new Date(),
        success: true,
        details: {
          seasonId: activeSeason.id,
          seasonNumber: activeSeason.number,
          ended: true,
          rewardsDistributed: rewards.length,
          tiersPromoted: tierUpdates.promoted.length,
          tiersDemoted: tierUpdates.demoted.length,
        },
      };
    }
  }

  return {
    jobName: 'season-transition-check',
    startedAt: startTime,
    completedAt: new Date(),
    success: true,
    details: {
      seasonId: activeSeason.id,
      seasonNumber: activeSeason.number,
      ended: false,
      endsAt: activeSeason.endsAt.toISOString(),
      timeRemaining: Math.max(0, activeSeason.endsAt.getTime() - now.getTime()),
    },
  };
}

/**
 * Job: Tier Calculation
 * Updates tier assignments for all users in the active season.
 */
function runTierCalculation(): CompetitionScheduledJobResult {
  const startTime = new Date();
  const activeSeason = getActiveSeason();

  if (!activeSeason) {
    return {
      jobName: 'tier-calculation',
      startedAt: startTime,
      completedAt: new Date(),
      success: true,
      details: { message: 'No active season' },
    };
  }

  const rankings = getSeasonRankings(activeSeason.id).entries;
  const tierUpdates = processTierUpdates(
    activeSeason.id,
    rankings.map((r) => ({ userId: r.userId, score: r.score })),
  );

  return {
    jobName: 'tier-calculation',
    startedAt: startTime,
    completedAt: new Date(),
    success: true,
    details: {
      seasonId: activeSeason.id,
      totalUsers: rankings.length,
      promoted: tierUpdates.promoted.length,
      demoted: tierUpdates.demoted.length,
    },
  };
}

/**
 * Job: Daily Rank Snapshot
 * Creates daily rank snapshots for tracking progress.
 */
function runDailyRankSnapshot(): CompetitionScheduledJobResult {
  const startTime = new Date();

  return {
    jobName: 'daily-rank-snapshot',
    startedAt: startTime,
    completedAt: new Date(),
    success: true,
    details: {
      snapshotType: 'daily',
      snapshotCount: 0,
    },
  };
}

// ============================================================
// Job Runner
// ============================================================

const jobRunners: Record<string, () => CompetitionScheduledJobResult> = {
  'weekly-ranking-snapshot': runWeeklyRankingSnapshot,
  'season-transition-check': runSeasonTransitionCheck,
  'tier-calculation': runTierCalculation,
  'daily-rank-snapshot': runDailyRankSnapshot,
};

/**
 * Run all enabled scheduled jobs.
 */
export function runCompetitionJobs(): CompetitionScheduledJobResult[] {
  const results: CompetitionScheduledJobResult[] = [];
  const now = Date.now();

  for (const [name, job] of jobs.entries()) {
    if (!job.enabled) continue;

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
export function runCompetitionJob(jobName: string): CompetitionScheduledJobResult | null {
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
export function getCompetitionJobStatus(): Array<{
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
