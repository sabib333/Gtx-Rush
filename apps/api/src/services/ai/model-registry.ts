/**
 * GTX Rush — AI Model Registry v1.0
 *
 * Every production model must be measurable and reversible (Contract §16).
 *
 * Lifecycle: test → shadow → active → retired
 * - SHADOW: model predicts but never affects users (§32)
 * - Promotion requires shadow evaluation with acceptable false-positive rate
 * - Drift detection flags degrading models for review (§46)
 * - Rollback restores the previous stable version (§47)
 *
 * SECURITY:
 * - Status transitions are explicit, auditable operations
 * - Shadow predictions are stored separately from live decisions
 *
 * Contract: AI Intelligence Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  AIDecision,
  FraudSignal,
  ModelHealthMetrics,
  ModelKind,
  ModelStatus,
  ModelVersion,
  RiskDomain,
  RiskLevel,
  ShadowComparison,
} from '@gtx-rush/types';
import {
  AI_MONITORING_CONFIG,
  AI_RISK_CONFIG,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const models = new Map<string, ModelVersion>(); // `${modelId}:${version}` → record
const latestByModel = new Map<string, string>(); // modelId → store key
const shadowComparisons = new Map<string, ShadowComparison[]>();
const decisions = new Map<string, AIDecision>();

function storeKey(modelId: string, version: string): string {
  return `${modelId}:${version}`;
}

// ============================================================
// Registration & Lifecycle
// ============================================================

export function registerModel(params: {
  modelId: string;
  kind: ModelKind;
  version: string;
  trainingDatasetVersion: string;
  featureSetVersion: string;
}): ModelVersion {
  const key = storeKey(params.modelId, params.version);
  if (models.has(key)) {
    throw new Error('MODEL_VERSION_ALREADY_EXISTS');
  }

  const model: ModelVersion = {
    ...params,
    deployedAt: null,
    status: 'test',
  };

  models.set(key, model);
  return model;
}

/**
 * Transition a model's status. Enforces valid lifecycle order.
 */
export function setModelStatus(
  modelId: string,
  version: string,
  status: ModelStatus,
): boolean {
  const key = storeKey(modelId, version);
  const model = models.get(key);
  if (!model) return false;

  // Retired models cannot be revived
  if (model.status === 'retired' && status !== 'retired') return false;

  model.status = status;
  if (status === 'active') {
    model.deployedAt = new Date();
    latestByModel.set(modelId, key);

    // Only one ACTIVE version per model — retire others
    for (const [otherKey, other] of models) {
      if (
        other.modelId === modelId &&
        other.version !== version &&
        other.status === 'active'
      ) {
        other.status = 'retired';
      }
    }
  }

  return true;
}

export function getModel(modelId: string, version: string): ModelVersion | null {
  return models.get(storeKey(modelId, version)) ?? null;
}

export function getActiveModel(modelId: string): ModelVersion | null {
  const key = latestByModel.get(modelId);
  if (!key) return null;
  const model = models.get(key);
  return model && model.status === 'active' ? model : null;
}

export function listModels(kind?: ModelKind): ModelVersion[] {
  return Array.from(models.values())
    .filter((m) => !kind || m.kind === kind)
    .sort((a, b) => (b.deployedAt?.getTime() ?? 0) - (a.deployedAt?.getTime() ?? 0));
}

/**
 * Rollback (§47): promote a previous stable version back to active.
 * The current active version is retired.
 */
export function rollbackModel(modelId: string, toVersion: string): boolean {
  const target = getModel(modelId, toVersion);
  if (!target || target.status === 'retired') return false;

  const current = getActiveModel(modelId);
  if (current && current.version !== toVersion) {
    setModelStatus(modelId, current.version, 'retired');
  }
  return setModelStatus(modelId, toVersion, 'active');
}

// ============================================================
// Shadow Mode (§32)
// ============================================================

export function isShadowMode(modelId: string, version?: string): boolean {
  const model =
    (version ? getModel(modelId, version) : null) ?? getActiveModel(modelId);
  return model?.status === 'shadow';
}

/**
 * Record a shadow comparison: what the model predicted vs the actual outcome.
 * Used to evaluate promotion before activation.
 */
export function recordShadowComparison(
  modelId: string,
  prediction: number,
  actualOutcome: ShadowComparison['actualOutcome'],
): void {
  const list = shadowComparisons.get(modelId) ?? [];
  list.push({
    modelId,
    prediction,
    actualOutcome,
    recordedAt: new Date(),
  });
  shadowComparisons.set(modelId, list);
}

export interface ShadowEvaluation {
  eligibleForPromotion: boolean;
  totalComparisons: number;
  predictedHighRisk: number;
  confirmedFraud: number;
  falsePositives: number;
  falsePositiveRate: number;
  reasonCode: string;
}

/**
 * Evaluate whether a shadow model may be promoted (§32).
 * Requires minimum sample and acceptable FP rate.
 */
export function evaluateShadowModel(modelId: string): ShadowEvaluation {
  const comparisons = shadowComparisons.get(modelId) ?? [];
  const resolved = comparisons.filter((c) => c.actualOutcome !== 'pending');

  const predictedHighRisk = comparisons.filter((c) => c.prediction >= AI_RISK_CONFIG.levels.high).length;
  const confirmedFraud = resolved.filter((c) => c.actualOutcome === 'fraud_confirmed').length;
  const falsePositives = resolved.filter(
    (c) => c.prediction >= AI_RISK_CONFIG.levels.high && c.actualOutcome === 'false_positive',
  ).length;

  const fpRate = resolved.length > 0 ? falsePositives / Math.max(1, predictedHighRisk) : 0;
  const enoughData = resolved.length >= AI_MONITORING_CONFIG.minPredictionsForMetrics / 2;

  return {
    eligibleForPromotion: enoughData && fpRate <= AI_MONITORING_CONFIG.driftFalsePositiveRateThreshold,
    totalComparisons: comparisons.length,
    predictedHighRisk,
    confirmedFraud,
    falsePositives,
    falsePositiveRate: fpRate,
    reasonCode: !enoughData
      ? 'INSUFFICIENT_SHADOW_DATA'
      : fpRate > AI_MONITORING_CONFIG.driftFalsePositiveRateThreshold
        ? 'FALSE_POSITIVE_RATE_TOO_HIGH'
        : 'SHADOW_EVALUATION_PASSED',
  };
}

// ============================================================
// Versioned Decisions (§28)
// ============================================================

/**
 * Build an auditable AI decision. Anti-cheat decisions produced here are
 * RISK SIGNALS — they never execute punishment directly.
 */
export function createDecision(params: {
  domain: RiskDomain;
  subjectId: string;
  modelId: string;
  decision: string;
  riskScore: number;
  confidence?: number;
  signals?: FraudSignal[];
}): AIDecision {
  const model = getActiveModel(params.modelId) ?? getModelLatest(params.modelId);

  const riskLevel = riskLevelFromScore(params.riskScore);
  const distinctSignals = new Set((params.signals ?? []).map((s) => s.type)).size;
  const reasonCodes = (params.signals ?? []).map((s) => s.type);

  // §30: HIGH/CRITICAL requires multiple distinct signals
  let finalLevel = riskLevel;
  if (
    (riskLevel === 'high' || riskLevel === 'critical') &&
    distinctSignals < AI_RISK_CONFIG.minDistinctSignalsForHigh
  ) {
    finalLevel = 'medium';
    reasonCodes.push('downgraded_insufficient_distinct_signals');
  }

  const decision: AIDecision = {
    id: nanoid(),
    domain: params.domain,
    subjectId: params.subjectId,
    modelId: params.modelId,
    modelVersion: model?.version ?? 'unversioned',
    featureSetVersion: model?.featureSetVersion ?? 'v0',
    decision: params.decision,
    confidence: params.confidence ?? Math.min(1, params.riskScore / 100),
    riskScore: params.riskScore,
    riskLevel: finalLevel,
    reasonCodes,
    signals: params.signals ?? [],
    shadowMode: model?.status === 'shadow',
    createdAt: new Date(),
  };

  decisions.set(decision.id, decision);
  return decision;
}

function getModelLatest(modelId: string): ModelVersion | null {
  const key = latestByModel.get(modelId);
  return key ? models.get(key) ?? null : null;
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= AI_RISK_CONFIG.levels.critical) return 'critical';
  if (score >= AI_RISK_CONFIG.levels.high) return 'high';
  if (score >= AI_RISK_CONFIG.levels.medium) return 'medium';
  return 'low';
}

export function getDecision(decisionId: string): AIDecision | null {
  return decisions.get(decisionId) ?? null;
}

// ============================================================
// Monitoring & Drift (§45, §46)
// ============================================================

interface OutcomeLedgerEntry {
  modelId: string;
  flagged: boolean; // model said high-risk
  actual: 'fraud_confirmed' | 'false_positive';
}

const outcomeLedger = new Map<string, OutcomeLedgerEntry[]>(); // modelId → entries

export function recordOutcome(
  modelId: string,
  flagged: boolean,
  actual: OutcomeLedgerEntry['actual'],
): void {
  const ledger = outcomeLedger.get(modelId) ?? [];
  ledger.push({ modelId, flagged, actual });
  outcomeLedger.set(modelId, ledger);
}

export function getModelHealth(modelId: string): ModelHealthMetrics | null {
  const model = getActiveModel(modelId) ?? getModelLatest(modelId);
  if (!model) return null;

  const ledger = outcomeLedger.get(modelId) ?? [];
  const totalPredictions = decisions.size > 0
    ? Array.from(decisions.values()).filter((d) => d.modelId === modelId).length
    : 0;

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let trueNegatives = 0;

  for (const entry of ledger) {
    if (entry.flagged && entry.actual === 'fraud_confirmed') truePositives++;
    else if (entry.flagged) falsePositives++;
    else if (entry.actual === 'fraud_confirmed') falseNegatives++;
    else trueNegatives++;
  }

  const precision =
    truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
  const recall =
    truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
  const fpr =
    falsePositives + trueNegatives > 0
      ? falsePositives / (falsePositives + trueNegatives)
      : 0;

  const evaluated = ledger.length >= AI_MONITORING_CONFIG.minPredictionsForMetrics;
  const driftFlagged = evaluated && fpr > AI_MONITORING_CONFIG.driftFalsePositiveRateThreshold;

  return {
    modelId,
    version: model.version,
    status: model.status,
    totalPredictions,
    confirmedFraud: truePositives,
    falsePositives,
    falsePositiveRate: fpr,
    precision,
    recall,
    driftFlagged,
    lastEvaluatedAt: evaluated ? new Date() : null,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearModelRegistry(): void {
  models.clear();
  latestByModel.clear();
  shadowComparisons.clear();
  decisions.clear();
  outcomeLedger.clear();
}
