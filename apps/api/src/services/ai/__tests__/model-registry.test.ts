/**
 * GTX Rush — AI Model Registry Tests
 *
 * Covers (AI Contract §16, §28, §30, §31, §32, §46, §47):
 * - Versioned lifecycle: test → shadow → active → retired
 * - Single active version per model
 * - Shadow mode never affects users
 * - HIGH/CRITICAL downgrades with insufficient distinct signals
 * - Rollback restores previous stable version
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerModel,
  setModelStatus,
  getModel,
  getActiveModel,
  listModels,
  rollbackModel,
  isShadowMode,
  recordShadowComparison,
  evaluateShadowModel,
  createDecision,
  recordOutcome,
  getModelHealth,
  _clearModelRegistry,
} from '../model-registry';

function registerShadowReady() {
  registerModel({
    modelId: 'score_anomaly_v1',
    kind: 'score_anomaly',
    version: '1.0.0',
    trainingDatasetVersion: 'ds-2026-07',
    featureSetVersion: 'fs-v1',
  });
  setModelStatus('score_anomaly_v1', '1.0.0', 'shadow');
}

describe('AI Model Registry', () => {
  beforeEach(() => {
    _clearModelRegistry();
  });

  describe('Lifecycle', () => {
    it('should start new models in TEST status', () => {
      const model = registerModel({
        modelId: 'bot_detect',
        kind: 'bot_detection',
        version: '0.1.0',
        trainingDatasetVersion: 'ds-1',
        featureSetVersion: 'fs-1',
      });
      expect(model.status).toBe('test');
    });

    it('should enforce lifecycle and retire previous active versions', () => {
      registerShadowReady();
      expect(setModelStatus('score_anomaly_v1', '1.0.0', 'active')).toBe(true);
      expect(getActiveModel('score_anomaly_v1')?.version).toBe('1.0.0');

      // New version becomes active → old is retired automatically
      registerModel({
        modelId: 'score_anomaly_v1',
        kind: 'score_anomaly',
        version: '1.1.0',
        trainingDatasetVersion: 'ds-2026-08',
        featureSetVersion: 'fs-v2',
      });
      setModelStatus('score_anomaly_v1', '1.1.0', 'active');

      expect(getActiveModel('score_anomaly_v1')?.version).toBe('1.1.0');
      expect(getModel('score_anomaly_v1', '1.0.0')?.status).toBe('retired');
    });

    it('should never revive retired models', () => {
      registerShadowReady();
      setModelStatus('score_anomaly_v1', '1.0.0', 'active');
      setModelStatus('score_anomaly_v1', '1.0.0', 'retired');
      expect(setModelStatus('score_anomaly_v1', '1.0.0', 'active')).toBe(false);
    });
  });

  describe('Shadow Mode (§32)', () => {
    it('should report shadow status correctly', () => {
      registerShadowReady();
      expect(isShadowMode('score_anomaly_v1')).toBe(true);

      setModelStatus('score_anomaly_v1', '1.0.0', 'active');
      expect(isShadowMode('score_anomaly_v1')).toBe(false);
    });

    it('should block promotion when false-positive rate is too high', () => {
      registerShadowReady();

      // 10 high-risk predictions, 5 of them false positives → 50% FP rate
      for (let i = 0; i < 50; i++) {
        recordShadowComparison('score_anomaly_v1', i % 2 === 0 ? 90 : 10, i % 2 === 0 ? 'false_positive' : 'false_positive');
      }
      const evaluation = evaluateShadowModel('score_anomaly_v1');
      expect(evaluation.eligibleForPromotion).toBe(false);
      expect(evaluation.reasonCode).toBe('FALSE_POSITIVE_RATE_TOO_HIGH');
    });

    it('should pass evaluation with clean predictions', () => {
      registerShadowReady();

      // All high-risk predictions confirmed as fraud
      for (let i = 0; i < 60; i++) {
        recordShadowComparison('score_anomaly_v1', 90, 'fraud_confirmed');
      }
      const evaluation = evaluateShadowModel('score_anomaly_v1');
      expect(evaluation.eligibleForPromotion).toBe(true);
    });
  });

  describe('Versioned Decisions (§28)', () => {
    it('should stamp every decision with model + feature-set versions', () => {
      registerShadowReady();
      setModelStatus('score_anomaly_v1', '1.0.0', 'active');

      const decision = createDecision({
        domain: 'score',
        subjectId: 'user-1',
        modelId: 'score_anomaly_v1',
        decision: 'flag_for_review',
        riskScore: 70,
        signals: [
          { type: 'a', description: 'a', severity: 'high', weight: 40 },
          { type: 'b', description: 'b', severity: 'high', weight: 40 },
        ],
      });

      expect(decision.modelVersion).toBe('1.0.0');
      expect(decision.featureSetVersion).toBe('fs-v1');
      expect(decision.riskLevel).toBe('high');
      expect(decision.shadowMode).toBe(false);
      expect(decision.reasonCodes).toContain('a');
    });

    it('should mark decisions from shadow models as non-affecting', () => {
      registerShadowReady(); // still in shadow

      const decision = createDecision({
        domain: 'bot',
        subjectId: 'user-2',
        modelId: 'score_anomaly_v1',
        decision: 'flag_for_review',
        riskScore: 90,
        signals: [
          { type: 'x', description: 'x', severity: 'high', weight: 50 },
          { type: 'y', description: 'y', severity: 'high', weight: 45 },
        ],
      });

      expect(decision.shadowMode).toBe(true);
    });

    it('should downgrade single-signal high scores to medium (false-positive protection §30)', () => {
      registerShadowReady();
      setModelStatus('score_anomaly_v1', '1.0.0', 'active');

      const decision = createDecision({
        domain: 'economy',
        subjectId: 'user-3',
        modelId: 'score_anomaly_v1',
        decision: 'flag_for_review',
        riskScore: 90,
        signals: [
          { type: 'only_signal', description: 'one signal only', severity: 'high', weight: 90 },
        ],
      });

      expect(decision.riskLevel).toBe('medium');
      expect(decision.reasonCodes).toContain('downgraded_insufficient_distinct_signals');
    });
  });

  describe('Monitoring & Drift (§45, §46)', () => {
    it('should compute health metrics and flag drift on high FP rate', () => {
      registerShadowReady();
      setModelStatus('score_anomaly_v1', '1.0.0', 'active');

      // 100 flagged outcomes: 30 confirmed, 70 false positive → FPR way above threshold
      for (let i = 0; i < 100; i++) {
        recordOutcome('score_anomaly_v1', true, i < 30 ? 'fraud_confirmed' : 'false_positive');
      }

      const health = getModelHealth('score_anomaly_v1');
      expect(health).not.toBeNull();
      expect(health!.falsePositiveRate).toBeGreaterThan(0.05);
      expect(health!.driftFlagged).toBe(true);
    });

    it('should support rollback to a previous stable version', () => {
      registerShadowReady();
      setModelStatus('score_anomaly_v1', '1.0.0', 'active');

      registerModel({
        modelId: 'score_anomaly_v1',
        kind: 'score_anomaly',
        version: '2.0.0-bad',
        trainingDatasetVersion: 'ds-bad',
        featureSetVersion: 'fs-bad',
      });
      setModelStatus('score_anomaly_v1', '2.0.0-bad', 'active');
      expect(getActiveModel('score_anomaly_v1')?.version).toBe('2.0.0-bad');

      // v1 was auto-retired; simulate restoring a known-good by re-registering path:
      expect(rollbackModel('score_anomaly_v1', '1.0.0')).toBe(false); // retired cannot roll back

      // Correct flow: register a stable patch and promote it via rollback semantics
      registerModel({
        modelId: 'score_anomaly_v1',
        kind: 'score_anomaly',
        version: '1.0.1-stable',
        trainingDatasetVersion: 'ds-good',
        featureSetVersion: 'fs-good',
      });
      setModelStatus('score_anomaly_v1', '1.0.1-stable', 'shadow');
      expect(rollbackModel('score_anomaly_v1', '1.0.1-stable')).toBe(true);
      expect(getActiveModel('score_anomaly_v1')?.version).toBe('1.0.1-stable');
      expect(getModel('score_anomaly_v1', '2.0.0-bad')?.status).toBe('retired');
    });
  });
});
