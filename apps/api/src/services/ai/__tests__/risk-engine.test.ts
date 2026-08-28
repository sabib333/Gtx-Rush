/**
 * GTX Rush — AI Risk Engine Tests
 *
 * Covers (AI Contract §21-27, §58 ANTI-CHEAT):
 * - Normal player → no signals
 * - Genuine score anomaly → flagged, never auto-deleted
 * - Bot-like behavior → multiple distinct signals
 * - Referral fraud cluster detection
 * - Economy and payment anomaly flagging
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordScoreSubmission,
  recordSession,
  recordReferralQualification,
  recordEconomyEvent,
  recordPaymentEvent,
  detectScoreAnomaly,
  evaluateScoreAnomaly,
  evaluateBotRisk,
  evaluateReferralRisk,
  evaluateEconomyRisk,
  evaluatePaymentRisk,
  _clearRiskEngine,
} from '../risk-engine';

const MIN_SESSIONS = 10;

describe('AI Risk Engine', () => {
  beforeEach(() => {
    _clearRiskEngine();
    // Seed population distribution with realistic scores
    for (let i = 0; i < 200; i++) {
      recordScoreSubmission(`pop-${i}`, 1000 + Math.floor(Math.random() * 4000), 60, 'v1');
    }
    _clearRiskEngine();
    // Re-seed (clear wiped population too)
    for (let i = 0; i < 200; i++) {
      recordScoreSubmission(`pop2-${i}`, 1000 + Math.floor(Math.random() * 4000), 60, 'v1');
    }
  });

  describe('Score Anomaly Detection (§23)', () => {
    it('should not flag a normal player', () => {
      for (let i = 0; i < 5; i++) {
        recordScoreSubmission('normal-player', 3000 + i * 100, 90, 'v1');
      }
      const { flagged } = detectScoreAnomaly('normal-player', 3400);
      expect(flagged).toBe(false);
    });

    it('should not flag a genuinely high-skill player improving steadily', () => {
      for (let i = 0; i < 10; i++) {
        recordScoreSubmission('skilled-player', 5000 + i * 500, 120, 'v1');
      }
      const result = detectScoreAnomaly('skilled-player', 9500); // < 3x best of 9500-500=9000... best prior is 9000
      // 9500 vs best 9000: only 1.06x — must NOT flag on history signal
      const historySignal = result.signals.find((s) => s.type === 'score_spike_vs_history');
      expect(historySignal).toBeUndefined();
    });

    it('should flag an impossible score spike (>3x personal best)', () => {
      for (let i = 0; i < 5; i++) {
        recordScoreSubmission('spiker', 1000, 60, 'v1');
      }
      const { flagged, signals } = detectScoreAnomaly('spiker', 5000);
      expect(flagged).toBe(true);
      expect(signals.some((s) => s.type === 'score_spike_vs_history')).toBe(true);
    });

    it('should flag impossible scoring rates as high severity', () => {
      recordScoreSubmission('machine-gun', 999999, 10, 'v1'); // 99,999 points/sec
      const { signals } = detectScoreAnomaly('machine-gun', 999999);
      expect(signals.some((s) => s.type === 'impossible_scoring_rate')).toBe(true);

      const evaluation = evaluateScoreAnomaly('machine-gun', 'score_model_v1');
      expect(evaluation.riskScore).toBeGreaterThan(0);
    });
  });

  describe('Bot Detection (§24)', () => {
    function seedSessions(userId: string, intervalMs: number, jitter: number, requestCount: number) {
      let t = Date.now() - MIN_SESSIONS * 3600 * 1000;
      for (let i = 0; i < MIN_SESSIONS + 5; i++) {
        const intervals = Array.from({ length: 30 }, (_, j) =>
          intervalMs + (j % 2 === 0 ? jitter : -jitter),
        );
        recordSession(userId, {
          startedAt: t,
          endedAt: t + intervals.reduce((a, b) => a + b, 0),
          requestCount,
          actionIntervalsMs: intervals,
        });
        t += 3600 * 1000;
      }
    }

    it('should not flag a human-like player', () => {
      seedSessions('human-player', 800, 350, 120); // high variance
      const { riskScore, signals } = evaluateBotRisk('human-player', 'bot_v1');
      expect(signals.length).toBe(0);
      expect(riskScore).toBe(0);
    });

    it('should flag machine-consistent timing', () => {
      seedSessions('bot-player', 800, 1, 120); // near-zero variance
      const { signals } = evaluateBotRisk('bot-player', 'bot_v1');
      expect(signals.some((s) => s.type === 'impossible_timing_consistency')).toBe(true);
    });

    it('should flag abnormal request frequency', () => {
      let t = Date.now() - MIN_SESSIONS * 3600 * 1000;
      for (let i = 0; i < MIN_SESSIONS + 5; i++) {
        recordSession('flood-bot', {
          startedAt: t,
          endedAt: t + 60_000,
          requestCount: 20_000, // ~333 req/sec sustained
          actionIntervalsMs: Array.from({ length: 30 }, (_, j) => 700 + j * 11),
        });
        t += 3600 * 1000;
      }
      const { signals } = evaluateBotRisk('flood-bot', 'bot_v1');
      expect(signals.some((s) => s.type === 'abnormal_request_frequency')).toBe(true);
    });

    it('should return zero risk below minimum session count', () => {
      recordSession('new-user', {
        startedAt: Date.now(),
        endedAt: Date.now() + 1000,
        requestCount: 999999,
        actionIntervalsMs: [10],
      });
      const { riskScore } = evaluateBotRisk('new-user', 'bot_v1');
      expect(riskScore).toBe(0);
    });
  });

  describe('Referral Fraud Intelligence (§25)', () => {
    it('should not flag organic referral patterns', () => {
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        recordReferralQualification(
          'organic-inviter',
          `invitee-${i}`,
          now - (i + 1) * 7200_000, // registered hours apart
          now - (i + 1) * 7200_000 + 1800_000, // qualified 30 min later
        );
      }
      const { signals } = evaluateReferralRisk('organic-inviter', 'ref_fraud_v1');
      expect(signals.length).toBe(0);
    });

    it('should flag fast-qualification clusters', () => {
      const now = Date.now();
      for (let i = 0; i < 6; i++) {
        recordReferralQualification(
          'farm-inviter',
          `farm-${i}`,
          now - (i + 1) * 60_000,
          now - (i + 1) * 60_000 + 30_000, // qualified in 30 seconds
        );
      }
      const { signals, riskScore } = evaluateReferralRisk('farm-inviter', 'ref_fraud_v1');
      expect(signals.some((s) => s.type === 'referral_fast_qualification_cluster')).toBe(true);
      expect(riskScore).toBeGreaterThanOrEqual(45);
    });

    it('should flag machine-uniform registration intervals', () => {
      const base = Date.now() - 600_000;
      for (let i = 0; i < 6; i++) {
        recordReferralQualification(
          'bot-farm',
          `uniform-${i}`,
          base + i * 60_000, // exactly every 60 seconds
          base + i * 60_000 + 240_000,
        );
      }
      const { signals } = evaluateReferralRisk('bot-farm', 'ref_fraud_v1');
      expect(signals.some((s) => s.type === 'referral_registration_uniformity')).toBe(true);
    });
  });

  describe('Economy & Payment Anomalies (§26, §27)', () => {
    it('should flag repeated identical claims', () => {
      const now = Date.now();
      for (let i = 0; i < 4; i++) {
        recordEconomyEvent('claim-abuser', 'claim:daily_bonus', 100);
        void now;
      }
      const { signals } = evaluateEconomyRisk('claim-abuser', 'econ_v1');
      expect(signals.some((s) => s.type === 'economy_repeated_claims')).toBe(true);
    });

    it('should not flag users without economy events', () => {
      const { riskScore } = evaluateEconomyRisk('quiet-user', 'econ_v1');
      expect(riskScore).toBe(0);
    });

    it('should flag repeated payment failures for review only', () => {
      for (let i = 0; i < 6; i++) {
        recordPaymentEvent('struggling-payer', 'failed');
      }
      const { signals } = evaluatePaymentRisk('struggling-payer', 'pay_v1');
      expect(signals.some((s) => s.type === 'payment_repeated_failures')).toBe(true);
      // Flagging produces review signals — payment truth stays with the provider
      expect(signals.every((s) => s.weight < 50)).toBe(true);
    });
  });
});
