/**
 * GTX Rush — Background Job Queue v1.0
 *
 * In-memory job queue with:
 * - Priority support
 * - Retry with exponential backoff
 * - Dead-letter queue for failed jobs
 * - Job idempotency via idempotency keys
 * - Graceful shutdown
 *
 * For MVP, uses in-memory queue.
 * For scale, replace with Redis-backed Bull/BullMQ.
 *
 * Contract: Production Infrastructure Contract v1.0
 */

import { createLogger } from './logger';

const log = createLogger('queue');

// ============================================================
// Job Types
// ============================================================

export type JobPriority = 'critical' | 'high' | 'normal' | 'low';

export interface Job {
  id: string;
  type: string;
  data: Record<string, unknown>;
  priority: JobPriority;
  idempotencyKey?: string;
  attempt: number;
  maxAttempts: number;
  backoffMs: number;
  createdAt: Date;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface JobHandler {
  (data: Record<string, unknown>): Promise<void>;
}

export interface JobOptions {
  priority?: JobPriority;
  maxAttempts?: number;
  backoffMs?: number;
  idempotencyKey?: string;
  delayMs?: number;
}

// ============================================================
// Priority Weights
// ============================================================

const PRIORITY_WEIGHT: Record<JobPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ============================================================
// Queue Class
// ============================================================

class JobQueue {
  private handlers = new Map<string, JobHandler>();
  private pendingJobs: Job[] = [];
  private activeJobs = new Map<string, Job>();
  private deadLetterQueue: Job[] = [];
  private processedIds = new Set<string>();
  private processing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private maxConcurrency = 5;
  private maxDeadLetterSize = 1000;

  constructor() {
    // Start processing loop
    this.timer = setInterval(() => this.processNext(), 100);
  }

  /**
   * Register a job handler.
   */
  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Enqueue a job.
   */
  enqueue(type: string, data: Record<string, unknown>, options: JobOptions = {}): Job {
    // Idempotency check
    if (options.idempotencyKey && this.processedIds.has(options.idempotencyKey)) {
      log.debug('Job skipped (idempotent)', { type, idempotencyKey: options.idempotencyKey });
      return { id: '', type, data, priority: options.priority ?? 'normal', attempt: 0, maxAttempts: 0, backoffMs: 0, createdAt: new Date(), scheduledAt: new Date() };
    }

    const job: Job = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      data,
      priority: options.priority ?? 'normal',
      idempotencyKey: options.idempotencyKey,
      attempt: 0,
      maxAttempts: options.maxAttempts ?? 3,
      backoffMs: options.backoffMs ?? 1000,
      createdAt: new Date(),
      scheduledAt: new Date(Date.now() + (options.delayMs ?? 0)),
    };

    this.pendingJobs.push(job);
    this.sortQueue();

    log.debug('Job enqueued', { jobId: job.id, type, priority: job.priority });
    return job;
  }

  /**
   * Process the next job in the queue.
   */
  private async processNext(): Promise<void> {
    if (this.processing) return;
    if (this.activeJobs.size >= this.maxConcurrency) return;

    // Find next eligible job
    const now = new Date();
    const jobIndex = this.pendingJobs.findIndex((j) => j.scheduledAt <= now);
    if (jobIndex === -1) return;

    const job = this.pendingJobs.splice(jobIndex, 1)[0]!;
    this.activeJobs.set(job.id, job);

    this.processing = true;
    try {
      await this.executeJob(job);
    } finally {
      this.processing = false;
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Execute a single job.
   */
  private async executeJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      log.warn('No handler for job type', { type: job.type, jobId: job.id });
      return;
    }

    job.attempt++;
    job.startedAt = new Date();

    try {
      await handler(job.data);
      job.completedAt = new Date();

      // Mark idempotency key as processed
      if (job.idempotencyKey) {
        this.processedIds.add(job.idempotencyKey);
        // Prevent memory leak: keep last 10000 keys
        if (this.processedIds.size > 10000) {
          const keys = Array.from(this.processedIds);
          this.processedIds = new Set(keys.slice(-5000));
        }
      }

      const duration = job.completedAt.getTime() - job.startedAt.getTime();
      log.debug('Job completed', { jobId: job.id, type: job.type, duration, attempt: job.attempt });
    } catch (err) {
      job.error = err instanceof Error ? err.message : String(err);
      job.failedAt = new Date();

      if (job.attempt < job.maxAttempts) {
        // Retry with backoff
        const backoff = job.backoffMs * Math.pow(2, job.attempt - 1);
        job.scheduledAt = new Date(Date.now() + backoff);
        this.pendingJobs.push(job);
        this.sortQueue();

        log.warn('Job failed, retrying', {
          jobId: job.id,
          type: job.type,
          attempt: job.attempt,
          maxAttempts: job.maxAttempts,
          nextRetryMs: backoff,
          error: job.error,
        });
      } else {
        // Move to dead-letter queue
        this.deadLetterQueue.push(job);
        if (this.deadLetterQueue.length > this.maxDeadLetterSize) {
          this.deadLetterQueue.shift();
        }

        log.error('Job moved to dead-letter queue', {
          jobId: job.id,
          type: job.type,
          attempts: job.attempt,
          error: job.error,
        });
      }
    }
  }

  /**
   * Sort queue by priority (lower weight = higher priority).
   */
  private sortQueue(): void {
    this.pendingJobs.sort((a, b) => {
      const pA = PRIORITY_WEIGHT[a.priority] ?? 2;
      const pB = PRIORITY_WEIGHT[b.priority] ?? 2;
      return pA - pB;
    });
  }

  /**
   * Get queue stats.
   */
  getStats(): {
    pending: number;
    active: number;
    deadLetter: number;
  } {
    return {
      pending: this.pendingJobs.length,
      active: this.activeJobs.size,
      deadLetter: this.deadLetterQueue.length,
    };
  }

  /**
   * Get dead-letter jobs for inspection.
   */
  getDeadLetterJobs(): Job[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Retry a dead-letter job.
   */
  retryDeadLetter(jobId: string): boolean {
    const index = this.deadLetterQueue.findIndex((j) => j.id === jobId);
    if (index === -1) return false;
    const job = this.deadLetterQueue.splice(index, 1)[0]!;
    job.attempt = 0;
    job.scheduledAt = new Date();
    job.failedAt = undefined;
    job.error = undefined;
    this.pendingJobs.push(job);
    this.sortQueue();
    return true;
  }

  /**
   * Graceful shutdown.
   */
  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    // Wait for active jobs to complete
    const maxWait = 10_000;
    const start = Date.now();
    while (this.activeJobs.size > 0 && Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, 100));
    }
    log.info('Queue shut down', { remaining: this.activeJobs.size });
  }
}

// ============================================================
// Exported Queue Instance
// ============================================================

export const queue = new JobQueue();

// ============================================================
// Common Job Types
// ============================================================

/** Notification delivery */
queue.register('notification', async (data) => {
  log.info('Processing notification', { userId: data.userId, type: data.type });
  // Placeholder for Telegram notification sending
});

/** Analytics event processing */
queue.register('analytics_event', async (data) => {
  log.debug('Processing analytics event', { event: data.event });
  // Placeholder for analytics pipeline
});

/** Leaderboard update */
queue.register('leaderboard_update', async (data) => {
  log.debug('Processing leaderboard update', { userId: data.userId, gameId: data.gameId });
  // Placeholder for leaderboard recalculation
});

/** Fraud analysis */
queue.register('fraud_analysis', async (data) => {
  log.info('Processing fraud analysis', { userId: data.userId, flagType: data.flagType });
  // Placeholder for fraud detection pipeline
});
