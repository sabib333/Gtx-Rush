/**
 * Challenge Scheduler — Tests
 *
 * Tests:
 * - Job execution
 * - Idempotent operations (safe to retry)
 * - Job status reporting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  runScheduledJobs,
  runJob,
  getJobStatus,
} from '../challenge-scheduler';
import { _clearAllChallenges } from '../challenge-engine';
import { _clearAllFriendChallenges } from '../friend-challenge';

describe('Challenge Scheduler', () => {
  beforeEach(() => {
    _clearAllChallenges();
    _clearAllFriendChallenges();
  });

  describe('Job Status', () => {
    it('should return status of all registered jobs', () => {
      const jobs = getJobStatus();

      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs.some((j) => j.name === 'activate-daily-challenge')).toBe(true);
      expect(jobs.some((j) => j.name === 'end-daily-challenge')).toBe(true);
      expect(jobs.some((j) => j.name === 'expire-friend-challenges')).toBe(true);
      expect(jobs.some((j) => j.name === 'prepare-next-daily-challenge')).toBe(true);
    });
  });

  describe('Job Execution', () => {
    it('should run all scheduled jobs', () => {
      const results = runScheduledJobs();

      expect(Array.isArray(results)).toBe(true);
      // Results should include jobs that were actually executed
      for (const result of results) {
        expect(result.jobName).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.startedAt).toBeInstanceOf(Date);
        expect(result.completedAt).toBeInstanceOf(Date);
      }
    });

    it('should run a specific job by name', () => {
      const result = runJob('activate-daily-challenge');

      expect(result).toBeDefined();
      expect(result!.jobName).toBe('activate-daily-challenge');
      expect(result!.success).toBe(true);
    });

    it('should return null for non-existent job', () => {
      const result = runJob('non-existent-job');

      expect(result).toBeNull();
    });
  });

  describe('Idempotency', () => {
    it('should be safe to run jobs multiple times', () => {
      // Run twice
      const results1 = runScheduledJobs();
      const results2 = runScheduledJobs();

      // Second run may not execute anything (due to interval check)
      // But if it does, results should still be valid
      for (const result of results2) {
        expect(result.success).toBe(true);
      }
    });

    it('should handle daily challenge not existing gracefully', () => {
      // No daily challenge created
      const result = runJob('end-daily-challenge');

      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(result!.details).toHaveProperty('message');
    });
  });
});
