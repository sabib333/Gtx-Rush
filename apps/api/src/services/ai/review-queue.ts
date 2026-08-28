/**
 * GTX Rush — AI Review Queue v1.0
 *
 * Human oversight for high-impact AI signals (§28, §29).
 *
 * Flow:
 *   Risk evaluation → versioned AIDecision
 *     → shadow mode? record prediction only, no user effect
 *     → low/medium? log signal, no action
 *     → high/critical? open REVIEW CASE for a human operator
 *
 * Admin actions: CONFIRM | DISMISS | ESCALATE | RESTRICT.
 * The AI never becomes an unreviewable authority.
 *
 * Contract: AI Intelligence Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  AdminReviewAction,
  AIReviewCase,
  FraudSignal,
  ReviewCaseStatus,
  ReviewCaseType,
  RiskDomain,
} from '@gtx-rush/types';
import { AI_RISK_CONFIG } from '@gtx-rush/config';
import { createDecision, getActiveModel, getModelHealth, isShadowMode, recordOutcome } from './model-registry';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const reviewCases = new Map<string, AIReviewCase>();
const casesBySubject = new Map<string, string[]>(); // subjectId → caseIds

// ============================================================
// Case Filing
// ============================================================

export interface RiskEvaluationInput {
  domain: RiskDomain;
  caseType: ReviewCaseType;
  subjectId: string;
  modelId: string;
  riskScore: number;
  signals: FraudSignal[];
}

/**
 * Submit a risk evaluation produced by any detection engine.
 * Returns the created review case, or null when below review threshold
 * or when the model is running in shadow mode.
 */
export function submitRiskEvaluation(input: RiskEvaluationInput): {
  decisionCreated: boolean;
  reviewCase: AIReviewCase | null;
  shadowMode: boolean;
} {
  const model = getActiveModel(input.modelId);
  const shadow = isShadowMode(input.modelId);

  const decision = createDecision({
    domain: input.domain,
    subjectId: input.subjectId,
    modelId: input.modelId,
    decision: 'flag_for_review',
    riskScore: input.riskScore,
    signals: input.signals,
  });

  // Track decision→model so human outcomes feed model monitoring (§45)
  lastModelForCases.set(decision.id, input.modelId);

  if (shadow) {
    return { decisionCreated: true, reviewCase: null, shadowMode: true };
  }

  const needsReview =
    decision.riskLevel === 'high' ||
    decision.riskLevel === 'critical';

  if (!needsReview) {
    return { decisionCreated: true, reviewCase: null, shadowMode: false };
  }

  // §29: high-risk cases ALWAYS enter human review
  const reviewCase: AIReviewCase = {
    id: nanoid(),
    caseType: input.caseType,
    subjectId: input.subjectId,
    decisionId: decision.id,
    riskScore: decision.riskScore,
    riskLevel: decision.riskLevel,
    reasonCodes: decision.reasonCodes,
    status: 'open',
    assignedTo: null,
    resolution: null,
    resolvedBy: null,
    createdAt: new Date(),
    resolvedAt: null,
  };

  reviewCases.set(reviewCase.id, reviewCase);
  const subjectCases = casesBySubject.get(input.subjectId) ?? [];
  subjectCases.push(reviewCase.id);
  casesBySubject.set(input.subjectId, subjectCases);

  return { decisionCreated: true, reviewCase, shadowMode: false };
}

// ============================================================
// Human Review Actions (§29)
// ============================================================

export function resolveReviewCase(
  caseId: string,
  action: AdminReviewAction,
  adminUserId: string,
  resolution?: string,
): AIReviewCase | null {
  const reviewCase = reviewCases.get(caseId);
  if (!reviewCase || reviewCase.status !== 'open') return null;

  const statusMap: Record<AdminReviewAction, ReviewCaseStatus> = {
    confirm: 'confirmed',
    dismiss: 'dismissed',
    escalate: 'escalated',
    restrict: 'restricted',
  };

  reviewCase.status = statusMap[action];
  reviewCase.resolvedBy = adminUserId;
  reviewCase.resolution = resolution ?? null;
  reviewCase.resolvedAt = new Date();

  // Feed outcome back to model monitoring (§45)
  const flagged = action === 'confirm' || action === 'restrict';
  recordOutcome(
    modelIdFromCase(reviewCase),
    flagged,
    flagged ? 'fraud_confirmed' : 'false_positive',
  );

  return reviewCase;
}

function modelIdFromCase(reviewCase: AIReviewCase): string {
  // Decision carries the model id; look it up through stored decisions
  void reviewCase;
  return lastModelForCases.get(reviewCase.decisionId) ?? 'unknown';
}

/** Track decision→model mapping so outcomes feed monitoring. */
const lastModelForCases = new Map<string, string>();

// ============================================================
// Queries
// ============================================================

export function getOpenCases(): AIReviewCase[] {
  return Array.from(reviewCases.values())
    .filter((c) => c.status === 'open')
    .sort((a, b) => b.riskScore - a.riskScore);
}

export function getCasesBySubject(subjectId: string): AIReviewCase[] {
  return (casesBySubject.get(subjectId) ?? [])
    .map((id) => reviewCases.get(id))
    .filter((c): c is AIReviewCase => c !== undefined);
}

export function getReviewCase(caseId: string): AIReviewCase | null {
  return reviewCases.get(caseId) ?? null;
}

export function getReviewQueueStats(): {
  open: number;
  confirmed: number;
  dismissed: number;
  escalated: number;
  restricted: number;
} {
  const stats = { open: 0, confirmed: 0, dismissed: 0, escalated: 0, restricted: 0 };
  for (const reviewCase of reviewCases.values()) {
    stats[reviewCase.status]++;
  }
  return stats;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearReviewQueue(): void {
  reviewCases.clear();
  casesBySubject.clear();
  lastModelForCases.clear();
}
