/**
 * Tap Rush — Game Engine Types
 *
 * Types used by the shared game engine framework.
 */

export interface TapRushInput {
  type: 'tap' | 'invalid_tap' | 'target_hit' | 'target_missed' | 'session_started' | 'session_finished';
  data: {
    targetId?: string;
    targetType?: string;
    tapX?: number;
    tapY?: number;
    targetX?: number;
    targetY?: number;
    combo?: number;
    [key: string]: unknown;
  };
}

export interface TapRushResult {
  score: number;
  validTaps: number;
  invalidTaps: number;
  accuracy: number;
  highestCombo: number;
  tapsPerSecond: number;
  bonusTaps: number;
  breakdown: {
    baseScore: number;
    comboBonus: number;
    bonusTargetScore: number;
    invalidTapPenalty: number;
  };
}
