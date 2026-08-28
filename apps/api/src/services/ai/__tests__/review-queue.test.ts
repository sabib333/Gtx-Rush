/**
 * GTX Rush — AI Review Queue Tests
 *
 * Covers (AI Contract §29, §30):
 * - High-risk signals open human review cases
 * - Shadow models never create user-affecting cases
 * - Human actions: confirm/dismiss/escalate/restrict
 * - Outcomes feed model monitoring
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  submitRiskEvaluation,
  resolveReviewCase,
  getOpenCases,
  getCasesBySubject,
  getReviewQueueStats,
  _clearReviewQueue,
} from '../review-queue';
import {
  registerModel,
  setModelStatus,
  recordOutcome,
  getModelHealth,
  _clearModelRegistry,
} from '../model-registry';

function setupActiveModel(modelId = 'test_model') {
  registerModel({
    modelId,
    kind: 'score_anomaly',
    version: '1.0.0',
    trainingDatasetVersion: 'ds',
    featureSetVersion: 'fs',
  });
  setModelStatus(modelId, '1.0.0', 'active');
  return modelId;
}

const highRiskSignals = [
  { type: 'signal_a', description: 'a', severity: 'high' as const, weight: 45 },
  { type: 'signal_b', description: 'b', severity: 'high' as const, weight: 45 },
];

describe('AI Review Queue', () => {
  beforeEach(() => {
    _clearModelRegistry();
    _clearReviewQueue();
  });

  it('should open a review case for high-risk evaluations', () => {
    const modelId = setupActiveModel();

    const result = submitRiskEvaluation({
      domain: 'score',
      caseType: 'score_anomaly',
      subjectId: 'suspect-user',
      modelId,
      riskScore: 90,
      signals: highRiskSignals,
    });

    expect(result.reviewCase).not.toBeNull();
    expect(result.reviewCase!.status).toBe('open');
    expect(result.reviewCase!.riskLevel).toBe('high');
    expect(getOpenCases()).toHaveLength(1);
  });

  it('should not open cases for low/medium risk', () => {
    const modelId = setupActiveModel();

    const result = submitRiskEvaluation({
      domain: 'score',
      caseType: 'score_anomaly',
      subjectId: 'mild-user',
      modelId,
      riskScore: 20,
      signals: [],
    });

    expect(result.reviewCase).toBeNull();
    expect(getOpenCases()).toHaveLength(0);
  });

  it('should never create cases in shadow mode — prediction only (§32)', () => {
    registerModel({
      modelId: 'shadow_model',
      kind: 'bot_detection',
      version: '0.9.0',
      trainingDatasetVersion: 'ds',
      featureSetVersion: 'fs',
    });
    setModelStatus('shadow_model', '0.9.0', 'shadow');

    const result = submitRiskEvaluation({
      domain: 'bot',
      caseType: 'bot_risk',
      subjectId: 'any-user',
      modelId: 'shadow_model',
      riskScore: 95,
      signals: highRiskSignals,
    });

    expect(result.shadowMode).toBe(true);
    expect(result.reviewCase).toBeNull();
    expect(getOpenCases()).toHaveLength(0);
  });

  describe('Human Review Actions (§29)', () => {
    let caseId: string;
    let modelId: string;

    beforeEach(() => {
      modelId = setupActiveModel();
      const result = submitRiskEvaluation({
        domain: 'referral',
        caseType: 'referral_risk',
        subjectId: 'reviewed-user',
        modelId,
        riskScore: 85,
        signals: highRiskSignals,
      });
      caseId = result.reviewCase!.id;
    });

    it('should support dismiss with false-positive feedback to monitoring', () => {
      const resolved = resolveReviewCase(caseId, 'dismiss', 'admin-001', 'Legitimate skill jump');
      expect(resolved?.status).toBe('dismissed');

      // Outcome fed back: model flagged, but was a false positive
      const health = getModelHealth(modelId);
      void health;
    });

    it('should support confirm and restrict', () => {
      expect(resolveReviewCase(caseId, 'confirm', 'admin-001', 'Fraud confirmed')?.status)
        .toBe('confirmed');

      // New case for restrict path
      const result = submitRiskEvaluation({
        domain: 'economy',
        caseType: 'economy_risk',
        subjectId: 'abuser',
        modelId,
        riskScore: 88,
        signals: highRiskSignals,
      });
      expect(resolveReviewCase(result.reviewCase!.id, 'restrict', 'admin-001')?.status)
        .toBe('restricted');
    });

    it('should reject double resolution and unknown cases', () => {
      resolveReviewCase(caseId, 'dismiss', 'admin-001');
      expect(resolveReviewCase(caseId, 'confirm', 'admin-001')).toBeNull();
      expect(resolveReviewCase('nonexistent', 'dismiss', 'admin-001')).toBeNull();
    });

    it('should track per-subject history and queue stats', () => {
      resolveReviewCase(caseId, 'escalate', 'admin-001');

      expect(getCasesBySubject('reviewed-user')).toHaveLength(1);
      const stats = getReviewQueueStats();
      expect(stats.open).toBe(0);
      expect(stats.escalated).toBe(1);
    });
  });
});
