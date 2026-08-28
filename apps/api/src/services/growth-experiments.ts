/**
 * GTX Rush — Growth Experiments Service v1.0
 *
 * A/B testing for growth surfaces (Contract §42):
 * - CTA wording, share timing, onboarding length, invite placement, etc.
 *
 * Every experiment MUST have:
 * - Hypothesis
 * - Variants (with weights)
 * - Target metric
 * - Duration (start/end)
 *
 * Assignment is deterministic per (experimentId, userId) so users get a
 * stable experience across sessions.
 */

import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import type {
  GrowthExperimentDefinition,
  GrowthExperimentStatus,
  GrowthExperimentVariant,
} from '@gtx-rush/types';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const experiments = new Map<string, GrowthExperimentDefinition>();
const assignments = new Map<string, Map<string, string>>(); // experimentId → (userId → variantId)
const conversions = new Map<string, Map<string, Set<string>>>(); // experimentId → (variantId → userIds)

// ============================================================
// Experiment Lifecycle
// ============================================================

export function createGrowthExperiment(params: {
  name: string;
  hypothesis: string;
  targetMetric: string;
  variants: Array<{ id: string; name: string; weight: number }>;
  durationDays: number;
}): GrowthExperimentDefinition {
  if (!params.name || !params.hypothesis) {
    throw new Error('EXPERIMENT_REQUIRES_HYPOTHESIS');
  }
  if (params.variants.length < 2) {
    throw new Error('EXPERIMENT_REQUIRES_AT_LEAST_TWO_VARIANTS');
  }

  const totalWeight = params.variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight <= 0) {
    throw new Error('EXPERIMENT_VARIANTS_REQUIRE_POSITIVE_WEIGHT');
  }

  const definition: GrowthExperimentDefinition = {
    id: nanoid(),
    name: params.name,
    hypothesis: params.hypothesis,
    targetMetric: params.targetMetric,
    status: 'draft',
    variants: params.variants as GrowthExperimentVariant[],
    startedAt: null,
    endsAt: null,
    createdAt: new Date(),
  };

  experiments.set(definition.id, definition);
  assignments.set(definition.id, new Map());
  conversions.set(definition.id, new Map());

  return definition;
}

export function startGrowthExperiment(
  experimentId: string,
  durationDays: number,
): boolean {
  const experiment = experiments.get(experimentId);
  if (!experiment || experiment.status !== 'draft') return false;

  experiment.status = 'running';
  experiment.startedAt = new Date();
  experiment.endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  return true;
}

export function setGrowthExperimentStatus(
  experimentId: string,
  status: GrowthExperimentStatus,
): boolean {
  const experiment = experiments.get(experimentId);
  if (!experiment) return false;
  experiment.status = status;
  return true;
}

export function getGrowthExperiment(
  experimentId: string,
): GrowthExperimentDefinition | null {
  return experiments.get(experimentId) ?? null;
}

export function listGrowthExperiments(): GrowthExperimentDefinition[] {
  return Array.from(experiments.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

/**
 * Auto-complete experiments whose duration has elapsed.
 */
export function checkExperimentDurations(): number {
  let completed = 0;
  const now = Date.now();
  for (const experiment of experiments.values()) {
    if (
      experiment.status === 'running' &&
      experiment.endsAt &&
      now > experiment.endsAt.getTime()
    ) {
      experiment.status = 'completed';
      completed++;
    }
  }
  return completed;
}

// ============================================================
// Variant Assignment
// ============================================================

/**
 * Deterministically assign a user to a variant.
 * Same user always gets the same variant while the experiment runs.
 */
export function assignVariant(
  experimentId: string,
  userId: string,
): { variantId: string } | null {
  const experiment = experiments.get(experimentId);
  if (!experiment || experiment.status !== 'running') return null;

  // Check existing assignment first (stability)
  const existing = assignments.get(experimentId)?.get(userId);
  if (existing) return { variantId: existing };

  // Deterministic bucket from hash — no randomness across restarts
  const hash = createHash('sha256')
    .update(`${experimentId}:${userId}`)
    .digest()
    .readUInt32BE(0);
  const bucket = hash % 100; // 0-99

  let cumulative = 0;
  let selectedVariant: string = experiment.variants[0]?.id ?? '';

  for (const variant of experiment.variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      selectedVariant = variant.id;
      break;
    }
  }

  assignments.get(experimentId)?.set(userId, selectedVariant);
  return { variantId: selectedVariant };
}

/**
 * Record that a user hit the target metric.
 */
export function recordConversion(
  experimentId: string,
  userId: string,
): boolean {
  const userAssignments = assignments.get(experimentId);
  if (!userAssignments) return false;

  const variantId = userAssignments.get(userId);
  if (!variantId) return false; // never count unassigned users

  const variantConversions = conversions.get(experimentId) ?? new Map();
  let users = variantConversions.get(variantId);
  if (!users) {
    users = new Set();
    variantConversions.set(variantId, users);
  }
  users.add(userId);

  conversions.set(experimentId, variantConversions);
  return true;
}

// ============================================================
// Results
// ============================================================

export function getExperimentResults(experimentId: string): {
  hypothesis: string;
  targetMetric: string;
  status: GrowthExperimentStatus;
  variants: Array<{
    id: string;
    name: string;
    assignedUsers: number;
    convertedUsers: number;
    conversionRate: number;
  }>;
  winner: string | null;
} | null {
  const experiment = experiments.get(experimentId);
  if (!experiment) return null;

  const userAssignments = assignments.get(experimentId) ?? new Map();
  const variantConversions = conversions.get(experimentId) ?? new Map();

  const results = experiment.variants.map((variant) => {
    let assignedUsers = 0;
    for (const v of userAssignments.values()) {
      if (v === variant.id) assignedUsers++;
    }
    const convertedUsers = variantConversions.get(variant.id)?.size ?? 0;
    return {
      id: variant.id,
      name: variant.name,
      assignedUsers,
      convertedUsers,
      conversionRate: assignedUsers > 0 ? convertedUsers / assignedUsers : 0,
    };
  });

  // Winner requires statistical sanity: at least 30 assigned users per arm
  const eligibleVariants = results.filter((r) => r.assignedUsers >= 30);
  let winner: string | null = null;
  if (
    eligibleVariants.length === results.length &&
    eligibleVariants.length >= 2 &&
    experiment.status === 'completed'
  ) {
    winner = [...eligibleVariants].sort(
      (a, b) => b.conversionRate - a.conversionRate,
    )[0]?.id ?? null;
  }

  return {
    hypothesis: experiment.hypothesis,
    targetMetric: experiment.targetMetric,
    status: experiment.status,
    variants: results,
    winner,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearGrowthExperiments(): void {
  experiments.clear();
  assignments.clear();
  conversions.clear();
}
