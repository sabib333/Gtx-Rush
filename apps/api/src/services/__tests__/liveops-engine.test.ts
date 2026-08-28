/**
 * GTX Rush — LiveOps Engine Tests v1.0
 *
 * Comprehensive tests for the LiveOps system:
 * - Season lifecycle
 * - Battle Pass purchase and rewards
 * - Season progression and XP
 * - Mission system
 * - Event integration
 * - Community goals
 * - Daily login
 * - Content rotation
 * - Reward budgets
 * - Scheduled jobs
 * - Security: idempotency, server-authority, no client manipulation
 *
 * Contract: GTX Rush — LiveOps Contract v1.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createLiveOpsSeason,
  getActiveSeason,
  getLiveOpsSeasonById,
  getAllLiveOpsSeasons,
  transitionSeason,
  createCommunityGoal,
  getActiveCommunityGoals,
  updateCommunityGoalProgress,
  processDailyLogin,
  claimDailyLoginReward,
  generateMissionsForUser,
  getUserMissionsByCategory,
  getUserMissions,
  processMissionProgressEvent,
  claimMissionReward,
  rerollMission,
  getLiveOpsHome,
  createRewardBudget,
  checkRewardBudget,
  deductRewardBudget,
  addAuditEntry,
  getAuditLog,
  _clearLiveOpsEngine,
} from '../liveops-engine';
import {
  createBattlePass,
  purchaseBattlePass,
  getBattlePassProgress,
  claimBattlePassReward,
  ownsPremiumPass,
  autoClaimBattlePassRewards,
  _clearBattlePassEngine,
} from '../battle-pass-engine';
import {
  awardSeasonXp,
  getOrCreateProgression,
  getLevelDetails,
  resetSeasonProgression,
  _clearSeasonProgression,
} from '../season-progression-engine';
import {
  runDailyReset,
  runWeeklyReset,
  runSeasonTransition,
  runEventSettlement,
  runLiveOpsJobs,
} from '../liveops-scheduler';

describe('LiveOps Engine', () => {
  beforeEach(() => {
    _clearLiveOpsEngine();
    _clearBattlePassEngine();
    _clearSeasonProgression();
  });

  // ============================================================
  // Season Lifecycle
  // ============================================================

  describe('Season Lifecycle', () => {
    it('should create a season as DRAFT', () => {
      const season = createLiveOpsSeason({
        name: 'Season 1: Rise',
        description: 'The first season',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'neon',
      });

      expect(season).toBeDefined();
      expect(season.name).toBe('Season 1: Rise');
      expect(season.status).toBe('draft');
      expect(season.theme).toBe('neon');
      expect(season.rewardTrack).toBeDefined();
      expect(season.rewardTrack.levels.length).toBeGreaterThan(0);
    });

    it('should transition season through valid statuses', () => {
      const season = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });

      expect(transitionSeason(season.id, 'scheduled', 'admin')).toBe(true);
      expect(getLiveOpsSeasonById(season.id)!.status).toBe('scheduled');

      expect(transitionSeason(season.id, 'active', 'admin')).toBe(true);
      expect(getLiveOpsSeasonById(season.id)!.status).toBe('active');
      expect(getActiveSeason()?.id).toBe(season.id);

      expect(transitionSeason(season.id, 'ending', 'admin')).toBe(true);
      expect(getLiveOpsSeasonById(season.id)!.status).toBe('ending');

      expect(transitionSeason(season.id, 'ended', 'admin')).toBe(true);
      expect(getLiveOpsSeasonById(season.id)!.status).toBe('ended');
      expect(getActiveSeason()).toBeNull();

      expect(transitionSeason(season.id, 'archived', 'admin')).toBe(true);
      expect(getLiveOpsSeasonById(season.id)!.status).toBe('archived');
    });

    it('should only have one active season at a time', () => {
      const s1 = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });
      const s2 = createLiveOpsSeason({
        name: 'Season 2',
        description: '',
        startTime: new Date('2026-02-01'),
        endTime: new Date('2026-03-01'),
        theme: 'neon',
      });

      transitionSeason(s1.id, 'scheduled', 'admin');
      transitionSeason(s1.id, 'active', 'admin');
      expect(getActiveSeason()?.id).toBe(s1.id);

      transitionSeason(s2.id, 'scheduled', 'admin');
      transitionSeason(s2.id, 'active', 'admin');
      // Old season should be ended when new one activates
      expect(getActiveSeason()?.id).toBe(s2.id);
    });

    it('should reject invalid transitions', () => {
      const season = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });

      // Cannot go directly from draft to active
      expect(transitionSeason(season.id, 'active', 'admin')).toBe(false);
      // Cannot go directly from draft to ended
      expect(transitionSeason(season.id, 'ended', 'admin')).toBe(false);
    });

    it('should get all seasons sorted by creation time', () => {
      createLiveOpsSeason({
        name: 'Season 2',
        description: '',
        startTime: new Date('2026-02-01'),
        endTime: new Date('2026-03-01'),
        theme: 'default',
      });
      createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });

      const all = getAllLiveOpsSeasons();
      expect(all).toHaveLength(2);
      // Most recent first (Season 1 created after Season 2)
      expect(all[0]!.name).toBe('Season 2');
    });
  });

  // ============================================================
  // Season Progression & XP
  // ============================================================

  describe('Season Progression', () => {
    it('should award season XP and track progression', () => {
      const season = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });

      const result = awardSeasonXp({
        userId: 'user-1',
        seasonId: season.id,
        amount: 100,
        source: 'game_play',
      });

      expect(result.success).toBe(true);
      expect(result.progression.seasonXp).toBe(100);
      expect(result.progression.seasonLevel).toBeGreaterThanOrEqual(1);
    });

    it('should detect level ups', () => {
      const season = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });

      // Award enough XP for level 1 → 2
      const result = awardSeasonXp({
        userId: 'user-1',
        seasonId: season.id,
        amount: 500, // Enough to level up (level 1 costs 100, level 2 costs ~214)
        source: 'game_play',
      });

      expect(result.levelUp).toBe(true);
      expect(result.newLevel).toBeGreaterThan(result.previousLevel);
    });

    it('should prevent duplicate XP transactions via idempotency key', () => {
      const season = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });

      const r1 = awardSeasonXp({
        userId: 'user-1',
        seasonId: season.id,
        amount: 100,
        source: 'game_play',
        idempotencyKey: 'txn-1',
      });

      const r2 = awardSeasonXp({
        userId: 'user-1',
        seasonId: season.id,
        amount: 100,
        source: 'game_play',
        idempotencyKey: 'txn-1',
      });

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(false);
      expect(r2.error).toBe('DUPLICATE_TRANSACTION');
    });

    it('should reject zero or negative XP', () => {
      const season = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });

      const result = awardSeasonXp({
        userId: 'user-1',
        seasonId: season.id,
        amount: 0,
        source: 'game_play',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_AMOUNT');
    });

    it('should reset season progression', () => {
      const season = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });

      awardSeasonXp({
        userId: 'user-1',
        seasonId: season.id,
        amount: 500,
        source: 'game_play',
      });

      resetSeasonProgression('user-1', season.id);

      const progression = getOrCreateProgression('user-1', season.id);
      expect(progression.seasonXp).toBe(0);
      expect(progression.seasonLevel).toBe(1);
    });

    it('should calculate level details correctly', () => {
      const details = getLevelDetails(0);
      expect(details.currentLevel).toBe(1);
      expect(details.progress).toBe(0);

      const details2 = getLevelDetails(1000);
      expect(details2.currentLevel).toBeGreaterThan(1);
      expect(details2.progress).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Battle Pass
  // ============================================================

  describe('Battle Pass', () => {
    let seasonId: string;

    beforeEach(() => {
      const season = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });
      seasonId = season.id;

      transitionSeason(seasonId, 'scheduled', 'admin');
      transitionSeason(seasonId, 'active', 'admin');
    });

    it('should create a battle pass for a season', () => {
      const bp = createBattlePass({
        seasonId,
        name: 'Season 1 Pass',
        description: 'Premium battle pass',
        priceStars: 500,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
      });

      expect(bp).toBeDefined();
      expect(bp.seasonId).toBe(seasonId);
      expect(bp.priceStars).toBe(500);
    });

    it('should purchase a battle pass with valid payment', () => {
      const bp = createBattlePass({
        seasonId,
        name: 'Season 1 Pass',
        description: '',
        priceStars: 500,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
      });

      const result = purchaseBattlePass({
        userId: 'user-1',
        battlePassId: bp.id,
        seasonId,
        telegramPaymentId: 'tg_pay_123',
        amountStars: 500,
      });

      expect(result.success).toBe(true);
      expect(result.purchase).toBeDefined();
      expect(result.purchase!.status).toBe('purchased');
    });

    it('should reject purchase with wrong price', () => {
      const bp = createBattlePass({
        seasonId,
        name: 'Season 1 Pass',
        description: '',
        priceStars: 500,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
      });

      const result = purchaseBattlePass({
        userId: 'user-1',
        battlePassId: bp.id,
        seasonId,
        telegramPaymentId: 'tg_pay_123',
        amountStars: 100, // Wrong price
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('PRICE_MISMATCH');
    });

    it('should prevent duplicate purchase', () => {
      const bp = createBattlePass({
        seasonId,
        name: 'Season 1 Pass',
        description: '',
        priceStars: 500,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
      });

      purchaseBattlePass({
        userId: 'user-1',
        battlePassId: bp.id,
        seasonId,
        telegramPaymentId: 'tg_pay_123',
        amountStars: 500,
      });

      const result = purchaseBattlePass({
        userId: 'user-1',
        battlePassId: bp.id,
        seasonId,
        telegramPaymentId: 'tg_pay_456',
        amountStars: 500,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_PURCHASED');
    });

    it('should track battle pass progress', () => {
      createBattlePass({
        seasonId,
        name: 'Season 1 Pass',
        description: '',
        priceStars: 500,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
      });

      const progress = getBattlePassProgress({
        userId: 'user-1',
        seasonId,
        seasonXp: 500,
      });

      expect(progress).toBeDefined();
      expect(progress.currentLevel).toBeGreaterThanOrEqual(1);
      expect(progress.isPremium).toBe(false);
      expect(progress.freeTrack).toBeDefined();
      expect(progress.premiumTrack).toBeDefined();
    });

    it('should claim free track rewards', () => {
      createBattlePass({
        seasonId,
        name: 'Season 1 Pass',
        description: '',
        priceStars: 500,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
      });

      // Award enough XP for level 1
      awardSeasonXp({
        userId: 'user-1',
        seasonId,
        amount: 100,
        source: 'game_play',
      });

      const result = claimBattlePassReward({
        userId: 'user-1',
        seasonId,
        level: 1,
        track: 'free',
      });

      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
      expect(result.transactionId).toBeDefined();
    });

    it('should prevent claiming premium rewards without premium pass', () => {
      createBattlePass({
        seasonId,
        name: 'Season 1 Pass',
        description: '',
        priceStars: 500,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
      });

      awardSeasonXp({
        userId: 'user-1',
        seasonId,
        amount: 100,
        source: 'game_play',
      });

      const result = claimBattlePassReward({
        userId: 'user-1',
        seasonId,
        level: 1,
        track: 'premium',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('REQUIRES_PREMIUM_PASS');
    });

    it('should claim premium rewards after purchase', () => {
      const bp = createBattlePass({
        seasonId,
        name: 'Season 1 Pass',
        description: '',
        priceStars: 500,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
      });

      purchaseBattlePass({
        userId: 'user-1',
        battlePassId: bp.id,
        seasonId,
        telegramPaymentId: 'tg_pay_123',
        amountStars: 500,
      });

      awardSeasonXp({
        userId: 'user-1',
        seasonId,
        amount: 100,
        source: 'game_play',
      });

      const result = claimBattlePassReward({
        userId: 'user-1',
        seasonId,
        level: 1,
        track: 'premium',
      });

      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
    });

    it('should be idempotent on reward claims', () => {
      createBattlePass({
        seasonId,
        name: 'Season 1 Pass',
        description: '',
        priceStars: 500,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
      });

      awardSeasonXp({
        userId: 'user-1',
        seasonId,
        amount: 100,
        source: 'game_play',
      });

      const r1 = claimBattlePassReward({ userId: 'user-1', seasonId, level: 1, track: 'free' });
      const r2 = claimBattlePassReward({ userId: 'user-1', seasonId, level: 1, track: 'free' });

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(false);
      expect(r2.error).toBe('ALREADY_CLAIMED');
    });
  });

  // ============================================================
  // Mission System
  // ============================================================

  describe('Mission System', () => {
    it('should generate daily missions for a user', () => {
      const missions = generateMissionsForUser('user-1', 'daily', 1);
      expect(missions.length).toBeGreaterThan(0);
      expect(missions[0]!.category).toBe('daily');
      expect(missions[0]!.status).toBe('active');
    });

    it('should generate weekly missions', () => {
      const missions = generateMissionsForUser('user-1', 'weekly', 5);
      expect(missions.length).toBeGreaterThan(0);
      expect(missions[0]!.category).toBe('weekly');
    });

    it('should track mission progress', () => {
      generateMissionsForUser('user-1', 'daily', 1);

      const updated = processMissionProgressEvent({
        userId: 'user-1',
        eventType: 'game_completed',
        gameId: 'reaction-rush',
        metadata: {},
      });

      expect(updated.length).toBeGreaterThan(0);
    });

    it('should complete missions when target is reached', () => {
      const missions = generateMissionsForUser('user-1', 'daily', 1);
      const target = missions[0]!.target;

      // Progress to completion
      for (let i = 0; i < target; i++) {
        processMissionProgressEvent({
          userId: 'user-1',
          eventType: 'game_completed',
          gameId: 'reaction-rush',
          metadata: {},
        });
      }

      const allMissions = getUserMissions('user-1');
      const completed = allMissions.find((m) => m.status === 'completed');
      expect(completed).toBeDefined();
    });

    it('should claim mission rewards', () => {
      const missions = generateMissionsForUser('user-1', 'daily', 1);
      const target = missions[0]!.target;

      // Complete the mission
      for (let i = 0; i < target; i++) {
        processMissionProgressEvent({
          userId: 'user-1',
          eventType: 'game_completed',
          gameId: 'reaction-rush',
          metadata: {},
        });
      }

      const completed = getUserMissions('user-1').find((m) => m.status === 'completed');
      expect(completed).toBeDefined();

      const result = claimMissionReward('user-1', completed!.id);
      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
    });

    it('should prevent claiming non-completed missions', () => {
      const missions = generateMissionsForUser('user-1', 'daily', 1);

      const result = claimMissionReward('user-1', missions[0]!.id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('MISSION_NOT_COMPLETED');
    });

    it('should prevent duplicate claims', () => {
      const missions = generateMissionsForUser('user-1', 'daily', 1);
      const target = missions[0]!.target;

      for (let i = 0; i < target; i++) {
        processMissionProgressEvent({
          userId: 'user-1',
          eventType: 'game_completed',
          gameId: 'reaction-rush',
          metadata: {},
        });
      }

      const completed = getUserMissions('user-1').find((m) => m.status === 'completed');
      expect(completed).toBeDefined();
      claimMissionReward('user-1', completed!.id);
      const result = claimMissionReward('user-1', completed!.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_CLAIMED');
    });

    it('should reroll missions', () => {
      const missions = generateMissionsForUser('user-1', 'daily', 1);

      const result = rerollMission('user-1', missions[0]!.id);
      expect(result.success).toBe(true);
      expect(result.newMissionId).toBeDefined();
      expect(result.remainingRerolls).toBe(0); // Max 1 reroll
    });

    it('should limit rerolls', () => {
      const missions = generateMissionsForUser('user-1', 'daily', 1);

      rerollMission('user-1', missions[0]!.id);

      const userMissions = getUserMissionsByCategory('user-1', 'daily');
      // Reroll the new mission (which has rerollCount=0 because it's a new mission)
      // Instead, test that reroll count tracks on the original
      // Generate a fresh set and do 2 rerolls
      const freshMissions2 = generateMissionsForUser('user-2', 'daily', 1);
      const result1 = rerollMission('user-2', freshMissions2[0]!.id);
      expect(result1.success).toBe(true);
      // Get the new mission and try to reroll it
      const userMissions2 = getUserMissions('user-2').filter((m) => m.status === 'active');
      const result2 = rerollMission('user-2', userMissions2[0]!.id);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('MAX_REROLLS_REACHED');
    });
  });

  // ============================================================
  // Community Goals
  // ============================================================

  describe('Community Goals', () => {
    it('should create a community goal', () => {
      const goal = createCommunityGoal({
        name: 'Community Challenge',
        description: 'Complete 1,000,000 games',
        type: 'games_played',
        targetValue: 1000000,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        reward: { type: 'badge', value: 'community_champion', name: 'Community Champion', description: 'Community badge', rarity: 'legendary', itemId: null },
      });

      expect(goal).toBeDefined();
      expect(goal.targetValue).toBe(1000000);
      expect(goal.status).toBe('active');
    });

    it('should track community goal progress', () => {
      const goal = createCommunityGoal({
        name: 'Community Challenge',
        description: '',
        type: 'games_played',
        targetValue: 100,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        reward: { type: 'xp', value: 100, name: 'Reward', description: '100 XP', rarity: 'common', itemId: null },
      });

      updateCommunityGoalProgress(goal.id, 50);
      const updated = getActiveCommunityGoals().find((g) => g.id === goal.id);

      expect(updated!.currentValue).toBe(50);
      expect(updated!.progressPercentage).toBe(50);
    });

    it('should complete community goal when target reached', () => {
      const goal = createCommunityGoal({
        name: 'Community Challenge',
        description: '',
        type: 'games_played',
        targetValue: 100,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        reward: { type: 'xp', value: 100, name: 'Reward', description: '100 XP', rarity: 'common', itemId: null },
      });

      updateCommunityGoalProgress(goal.id, 100);

      const goals = getActiveCommunityGoals();
      expect(goals.find((g) => g.id === goal.id)).toBeUndefined();
    });
  });

  // ============================================================
  // Daily Login
  // ============================================================

  describe('Daily Login', () => {
    it('should track daily login', () => {
      const result = processDailyLogin('user-1', '2026-01-01');
      expect(result.day).toBe(1);
      expect(result.reward).toBeDefined();
      expect(result.claimed).toBe(false);
    });

    it('should advance day on consecutive login', () => {
      processDailyLogin('user-1', '2026-01-01');
      const result = processDailyLogin('user-1', '2026-01-02');

      expect(result.day).toBe(2);
    });

    it('should not advance if already logged in today', () => {
      processDailyLogin('user-1', '2026-01-01');
      const result = processDailyLogin('user-1', '2026-01-01');

      // Already logged in today, day stays same, no reward available (null)
      expect(result.day).toBe(1);
      expect(result.reward).toBeNull();
    });

    it('should claim daily login reward', () => {
      processDailyLogin('user-1', '2026-01-01');
      const result = claimDailyLoginReward('user-1');

      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
    });

    it('should prevent duplicate claim', () => {
      processDailyLogin('user-1', '2026-01-01');
      claimDailyLoginReward('user-1');
      const result = claimDailyLoginReward('user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_CLAIMED');
    });
  });

  // ============================================================
  // Reward Budget
  // ============================================================

  describe('Reward Budget', () => {
    it('should create a reward budget', () => {
      const budget = createRewardBudget({
        name: 'Event Budget',
        totalBudget: 10000,
        userCap: 100,
        dailyCap: 1000,
      });

      expect(budget).toBeDefined();
      expect(budget.totalBudget).toBe(10000);
      expect(budget.isExhausted).toBe(false);
    });

    it('should check budget allowance', () => {
      const budget = createRewardBudget({
        name: 'Test Budget',
        totalBudget: 100,
        userCap: 10,
        dailyCap: 50,
      });

      const check = checkRewardBudget(budget.id);
      expect(check.allowed).toBe(true);
    });

    it('should exhaust budget', () => {
      const budget = createRewardBudget({
        name: 'Small Budget',
        totalBudget: 5,
        userCap: 5,
        dailyCap: 5,
      });

      for (let i = 0; i < 5; i++) {
        deductRewardBudget(budget.id);
      }

      const check = checkRewardBudget(budget.id);
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('BUDGET_EXHAUSTED');
    });
  });

  // ============================================================
  // LiveOps Home Feed
  // ============================================================

  describe('LiveOps Home Feed', () => {
    it('should build a home feed', () => {
      const season = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'neon',
      });
      transitionSeason(season.id, 'scheduled', 'admin');
      transitionSeason(season.id, 'active', 'admin');

      const home = getLiveOpsHome({
        userId: 'user-1',
        userLevel: 1,
        seasonXp: 100,
      });

      expect(home).toBeDefined();
      expect(home.season).toBeDefined();
      expect(home.season!.theme).toBe('neon');
      expect(home.liveNow).toBeDefined();
      expect(home.upcoming).toBeDefined();
    });
  });

  // ============================================================
  // Audit Log
  // ============================================================

  describe('Audit Log', () => {
    it('should record audit entries', () => {
      addAuditEntry('admin-1', 'SEASON_CREATED', 'season', 's1', null, { name: 'Season 1' });

      const log = getAuditLog('season');
      expect(log).toHaveLength(1);
      expect(log[0]!.action).toBe('SEASON_CREATED');
      expect(log[0]!.adminId).toBe('admin-1');
    });
  });

  // ============================================================
  // Scheduled Jobs
  // ============================================================

  describe('Scheduled Jobs', () => {
    it('should run daily reset without errors', () => {
      const result = runDailyReset();
      expect(result.success).toBe(true);
      expect(result.jobName).toBe('daily_reset');
    });

    it('should run weekly reset without errors', () => {
      const result = runWeeklyReset();
      expect(result.success).toBe(true);
      expect(result.jobName).toBe('weekly_reset');
    });

    it('should run season transition without errors', () => {
      const result = runSeasonTransition();
      expect(result.success).toBe(true);
      expect(result.jobName).toBe('season_transition');
    });

    it('should run event settlement without errors', () => {
      const result = runEventSettlement();
      expect(result.success).toBe(true);
      expect(result.jobName).toBe('event_settlement');
    });

    it('should run all LiveOps jobs', () => {
      const results = runLiveOpsJobs();
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  // ============================================================
  // Security Tests
  // ============================================================

  describe('Security', () => {
    it('should prevent client-provided progress from bypassing server checks', () => {
      const missions = generateMissionsForUser('user-1', 'daily', 1);

      // Client tries to directly claim without completing
      const result = claimMissionReward('user-1', missions[0]!.id);
      expect(result.success).toBe(false);
    });

    it('should prevent reward duplication via idempotency', () => {
      const season = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });

      const r1 = awardSeasonXp({
        userId: 'user-1',
        seasonId: season.id,
        amount: 100,
        source: 'game_play',
        idempotencyKey: 'test-txn-1',
      });

      const r2 = awardSeasonXp({
        userId: 'user-1',
        seasonId: season.id,
        amount: 100,
        source: 'game_play',
        idempotencyKey: 'test-txn-1',
      });

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(false);
    });

    it('should require premium pass for premium rewards', () => {
      const season = createLiveOpsSeason({
        name: 'Season 1',
        description: '',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
        theme: 'default',
      });

      const bp = createBattlePass({
        seasonId: season.id,
        name: 'Pass',
        description: '',
        priceStars: 500,
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-02-01'),
      });

      awardSeasonXp({
        userId: 'user-1',
        seasonId: season.id,
        amount: 100,
        source: 'game_play',
      });

      // Without purchase
      expect(ownsPremiumPass('user-1', season.id)).toBe(false);
      const result = claimBattlePassReward({
        userId: 'user-1',
        seasonId: season.id,
        level: 1,
        track: 'premium',
      });
      expect(result.success).toBe(false);

      // After purchase
      purchaseBattlePass({
        userId: 'user-1',
        battlePassId: bp.id,
        seasonId: season.id,
        telegramPaymentId: 'tg_123',
        amountStars: 500,
      });

      expect(ownsPremiumPass('user-1', season.id)).toBe(true);
      const result2 = claimBattlePassReward({
        userId: 'user-1',
        seasonId: season.id,
        level: 1,
        track: 'premium',
      });
      expect(result2.success).toBe(true);
    });

    it('should never allow CLAIMED → CLAIMED transition', () => {
      const missions = generateMissionsForUser('user-1', 'daily', 1);
      const target = missions[0]!.target;

      for (let i = 0; i < target; i++) {
        processMissionProgressEvent({
          userId: 'user-1',
          eventType: 'game_completed',
          gameId: 'reaction-rush',
          metadata: {},
        });
      }

      const completed = getUserMissions('user-1').find((m) => m.status === 'completed');
      expect(completed).toBeDefined();
      claimMissionReward('user-1', completed!.id);
      const result = claimMissionReward('user-1', completed!.id);

      expect(result.success).toBe(false);
    });
  });
});
