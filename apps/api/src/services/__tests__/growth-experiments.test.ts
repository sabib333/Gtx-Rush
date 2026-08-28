/**
 * GTX Rush — Growth Experiments Tests
 *
 * Covers (Growth Engine Contract §42):
 * - Experiments require hypothesis + variants + metric
 * - Deterministic variant assignment
 * - Weighted distribution
 * - Conversion tracking and results
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGrowthExperiment,
  startGrowthExperiment,
  setGrowthExperimentStatus,
  assignVariant,
  recordConversion,
  getExperimentResults,
  checkExperimentDurations,
  _clearGrowthExperiments,
} from '../growth-experiments';

function makeRunningExperiment() {
  const experiment = createGrowthExperiment({
    name: 'Invite CTA wording',
    hypothesis: 'Action-first CTA increases invite click-through by 5%',
    targetMetric: 'invite_click_rate',
    variants: [
      { id: 'control', name: 'Control', weight: 50 },
      { id: 'variant-a', name: 'Action CTA', weight: 50 },
    ],
    durationDays: 14,
  });
  startGrowthExperiment(experiment.id, 14);
  return experiment;
}

describe('Growth Experiments', () => {
  beforeEach(() => {
    _clearGrowthExperiments();
  });

  describe('Creation', () => {
    it('should require a hypothesis', () => {
      expect(() =>
        createGrowthExperiment({
          name: 'No Hypothesis',
          hypothesis: '',
          targetMetric: 'x',
          variants: [
            { id: 'a', name: 'A', weight: 50 },
            { id: 'b', name: 'B', weight: 50 },
          ],
          durationDays: 7,
        }),
      ).toThrow('EXPERIMENT_REQUIRES_HYPOTHESIS');
    });

    it('should require at least two variants', () => {
      expect(() =>
        createGrowthExperiment({
          name: 'One Arm',
          hypothesis: 'test',
          targetMetric: 'x',
          variants: [{ id: 'control', name: 'Control', weight: 100 }],
          durationDays: 7,
        }),
      ).toThrow('EXPERIMENT_REQUIRES_AT_LEAST_TWO_VARIANTS');
    });
  });

  describe('Assignment', () => {
    it('should not assign users to non-running experiments', () => {
      const draft = createGrowthExperiment({
        name: 'Draft',
        hypothesis: 'h',
        targetMetric: 'm',
        variants: [
          { id: 'a', name: 'A', weight: 50 },
          { id: 'b', name: 'B', weight: 50 },
        ],
        durationDays: 7,
      });

      expect(assignVariant(draft.id, 'user-1')).toBeNull();
    });

    it('should assign deterministically across calls', () => {
      const experiment = makeRunningExperiment();

      const first = assignVariant(experiment.id, 'user-42');
      const second = assignVariant(experiment.id, 'user-42');

      expect(first).not.toBeNull();
      expect(first!.variantId).toBe(second!.variantId);
    });

    it('should respect variant weights approximately', () => {
      const experiment = createGrowthExperiment({
        name: 'Weighted',
        hypothesis: 'h',
        targetMetric: 'm',
        variants: [
          { id: 'heavy', name: 'Heavy', weight: 90 },
          { id: 'light', name: 'Light', weight: 10 },
        ],
        durationDays: 7,
      });
      startGrowthExperiment(experiment.id, 7);

      let heavy = 0;
      for (let i = 0; i < 1000; i++) {
        const result = assignVariant(experiment.id, `user-${i}`);
        if (result?.variantId === 'heavy') heavy++;
      }

      // Expect ~90% with wide tolerance for hash distribution
      expect(heavy / 1000).toBeGreaterThan(0.8);
      expect(heavy / 1000).toBeLessThan(1.0);
    });
  });

  describe('Conversion & Results', () => {
    it('should never count conversions from unassigned users', () => {
      const experiment = makeRunningExperiment();
      expect(recordConversion(experiment.id, 'never-assigned')).toBe(false);
    });

    it('should compute per-variant conversion rates', () => {
      const experiment = makeRunningExperiment();

      for (let i = 0; i < 40; i++) {
        assignVariant(experiment.id, `u-${i}`);
      }
      recordConversion(experiment.id, 'u-0');
      recordConversion(experiment.id, 'u-1');

      const results = getExperimentResults(experiment.id);
      expect(results).not.toBeNull();
      const totalConverted = results!.variants.reduce(
        (sum, v) => sum + v.convertedUsers,
        0,
      );
      expect(totalConverted).toBe(2);
      // Winner requires completion + min sample
      expect(results!.winner).toBeNull();
    });

    it('should declare a winner only after completion with sufficient sample', () => {
      const experiment = createGrowthExperiment({
        name: 'Winner test',
        hypothesis: 'B beats A',
        targetMetric: 'conversion',
        variants: [
          { id: 'a', name: 'A', weight: 50 },
          { id: 'b', name: 'B', weight: 50 },
        ],
        durationDays: 7,
      });
      startGrowthExperiment(experiment.id, 7);

      // Large sample so both arms reliably exceed the 30-user minimum
      for (let i = 0; i < 300; i++) {
        const r = assignVariant(experiment.id, `w-${i}`);
        if (r?.variantId === 'a') recordConversion(experiment.id, `w-${i}`);
      }
      for (let i = 0; i < 300; i++) {
        assignVariant(experiment.id, `x-${i}`); // conversions only from w-* users in arm a
      }

      setGrowthExperimentStatus(experiment.id, 'completed');
      const results = getExperimentResults(experiment.id)!;
      expect(results.winner).toBe('a');
    });
  });

  describe('Duration', () => {
    it('should auto-complete running experiments past their end time', () => {
      const experiment = createGrowthExperiment({
        name: 'Short',
        hypothesis: 'h',
        targetMetric: 'm',
        variants: [
          { id: 'a', name: 'A', weight: 50 },
          { id: 'b', name: 'B', weight: 50 },
        ],
        durationDays: -1, // already elapsed
      });
      startGrowthExperiment(experiment.id, -1);

      const completed = checkExperimentDurations();
      expect(completed).toBeGreaterThanOrEqual(1);
      expect(getExperimentResults(experiment.id)!.status).toBe('completed');
    });
  });
});
