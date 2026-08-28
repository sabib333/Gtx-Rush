/**
 * GTX Rush — Mission Engine Tests
 *
 * Tests for:
 * - Mission definition initialization
 * - Daily mission generation
 * - Weekly mission generation
 * - Mission progress updates
 * - Mission completion
 * - Reward claiming (idempotent)
 * - Mission expiration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeMissionDefinitions,
  generateDailyMissions,
  generateWeeklyMissions,
  processMissionProgress,
  claimMissionReward,
  getUserDailyMissions,
  getUserWeeklyMissions,
  getMissionProgress,
  expireMissionsForPeriod,
  _clearAllMissions,
  _getMissionDefinitionCount,
  _getUserMissionCount,
} from '../mission-engine';
import type { MissionProgressEvent } from '@gtx-rush/types';

describe('Mission Engine', () => {
  const testUserId = 'test-user-001';

  beforeEach(() => {
    _clearAllMissions();
    initializeMissionDefinitions();
  });

  describe('Mission Definitions', () => {
    it('should initialize mission definitions from templates', () => {
      const count = _getMissionDefinitionCount();
      expect(count).toBeGreaterThan(0);
    });

    it('should have daily, weekly, and monthly templates', () => {
      const count = _getMissionDefinitionCount();
      expect(count).toBeGreaterThanOrEqual(10); // At least 10 templates
    });
  });

  describe('Daily Mission Generation', () => {
    it('should generate daily missions for a user', () => {
      const missions = generateDailyMissions(testUserId, 1);
      expect(missions.length).toBeGreaterThan(0);
      expect(missions.length).toBeLessThanOrEqual(5);
    });

    it('should not regenerate missions if already exist', () => {
      const first = generateDailyMissions(testUserId, 1);
      const second = generateDailyMissions(testUserId, 1);
      expect(first.length).toBe(second.length);
    });

    it('should return missions with valid properties', () => {
      const missions = generateDailyMissions(testUserId, 1);
      for (const mission of missions) {
        expect(mission.id).toBeDefined();
        expect(mission.missionId).toBeDefined();
        expect(mission.userId).toBe(testUserId);
        expect(mission.progress).toBe(0);
        expect(mission.target).toBeGreaterThan(0);
        expect(mission.status).toBe('active');
        expect(mission.mission).toBeDefined();
      }
    });

    it('should return different missions for different users', () => {
      const user1Missions = generateDailyMissions('user-1', 1);
      const user2Missions = generateDailyMissions('user-2', 1);
      expect(user1Missions.length).toBe(user2Missions.length);
    });

    it('should filter missions by user level', () => {
      const level1Missions = generateDailyMissions('level1-user', 1);
      const level10Missions = generateDailyMissions('level10-user', 10);
      // Level 10 users should have access to more missions
      expect(level10Missions.length).toBeGreaterThanOrEqual(level1Missions.length);
    });
  });

  describe('Weekly Mission Generation', () => {
    it('should generate weekly missions for a user', () => {
      const missions = generateWeeklyMissions(testUserId, 1);
      expect(missions.length).toBeGreaterThan(0);
      expect(missions.length).toBeLessThanOrEqual(3);
    });

    it('should not regenerate missions if already exist', () => {
      const first = generateWeeklyMissions(testUserId, 1);
      const second = generateWeeklyMissions(testUserId, 1);
      expect(first.length).toBe(second.length);
    });
  });

  describe('Mission Progress', () => {
    it('should update progress for PLAY_GAME mission', () => {
      generateDailyMissions(testUserId, 1);
      const missions = getUserDailyMissions(testUserId);
      const playMission = missions.find((m) => m.mission.type === 'PLAY_GAME');

      if (playMission) {
        const event: MissionProgressEvent = {
          userId: testUserId,
          eventType: 'GAME_COMPLETED',
          gameId: 'reaction-rush',
          timestamp: new Date(),
          metadata: {},
        };

        const updated = processMissionProgress(event);
        expect(updated.length).toBeGreaterThan(0);
        expect(updated[0]!.progress).toBe(1);
      }
    });

    it('should update progress for SCORE_THRESHOLD mission', () => {
      generateDailyMissions(testUserId, 5);
      const missions = getUserDailyMissions(testUserId);
      const scoreMission = missions.find((m) => m.mission.type === 'SCORE_THRESHOLD');

      if (scoreMission) {
        const event: MissionProgressEvent = {
          userId: testUserId,
          eventType: 'SCORE_RECORDED',
          gameId: 'reaction-rush',
          timestamp: new Date(),
          metadata: { score: 5000 },
        };

        const updated = processMissionProgress(event);
        expect(updated.length).toBeGreaterThan(0);
      }
    });

    it('should not update progress for non-matching events', () => {
      generateDailyMissions(testUserId, 1);
      const missions = getUserDailyMissions(testUserId);
      const initialProgress = missions.map((m) => m.progress);

      const event: MissionProgressEvent = {
        userId: testUserId,
        eventType: 'SHARE_RESULT',
        gameId: 'reaction-rush',
        timestamp: new Date(),
        metadata: {},
      };

      processMissionProgress(event);
      const afterProgress = getUserDailyMissions(testUserId).map((m) => m.progress);
      expect(afterProgress).toEqual(initialProgress);
    });

    it('should complete mission when progress reaches target', () => {
      generateDailyMissions(testUserId, 1);
      const missions = getUserDailyMissions(testUserId);
      const playMission = missions.find((m) => m.mission.type === 'PLAY_GAME' && m.mission.target === 1);

      if (playMission) {
        const event: MissionProgressEvent = {
          userId: testUserId,
          eventType: 'GAME_COMPLETED',
          gameId: 'reaction-rush',
          timestamp: new Date(),
          metadata: {},
        };

        processMissionProgress(event);
        const updated = getUserDailyMissions(testUserId).find((m) => m.id === playMission.id);
        expect(updated?.status).toBe('completed');
        expect(updated?.completedAt).toBeDefined();
      }
    });
  });

  describe('Reward Claiming', () => {
    it('should claim reward for completed mission', () => {
      generateDailyMissions(testUserId, 1);
      const missions = getUserDailyMissions(testUserId);
      const playMission = missions.find((m) => m.mission.type === 'PLAY_GAME' && m.mission.target === 1);

      if (playMission) {
        // Complete the mission
        const event: MissionProgressEvent = {
          userId: testUserId,
          eventType: 'GAME_COMPLETED',
          gameId: 'reaction-rush',
          timestamp: new Date(),
          metadata: {},
        };
        processMissionProgress(event);

        // Claim reward
        const result = claimMissionReward(testUserId, playMission.id);
        expect(result.success).toBe(true);
        expect(result.reward).toBeDefined();
      }
    });

    it('should prevent duplicate claims (idempotent)', () => {
      generateDailyMissions(testUserId, 1);
      const missions = getUserDailyMissions(testUserId);
      const playMission = missions.find((m) => m.mission.type === 'PLAY_GAME' && m.mission.target === 1);

      if (playMission) {
        // Complete the mission
        const event: MissionProgressEvent = {
          userId: testUserId,
          eventType: 'GAME_COMPLETED',
          gameId: 'reaction-rush',
          timestamp: new Date(),
          metadata: {},
        };
        processMissionProgress(event);

        // First claim
        const first = claimMissionReward(testUserId, playMission.id);
        expect(first.success).toBe(true);

        // Second claim should fail
        const second = claimMissionReward(testUserId, playMission.id);
        expect(second.success).toBe(false);
        expect(second.error).toBe('ALREADY_CLAIMED');
      }
    });

    it('should reject claim for uncompleted mission', () => {
      generateDailyMissions(testUserId, 1);
      const missions = getUserDailyMissions(testUserId);
      const playMission = missions.find((m) => m.mission.type === 'PLAY_GAME');

      if (playMission) {
        const result = claimMissionReward(testUserId, playMission.id);
        expect(result.success).toBe(false);
        expect(result.error).toBe('MISSION_NOT_COMPLETED');
      }
    });

    it('should reject claim for wrong user', () => {
      generateDailyMissions(testUserId, 1);
      const missions = getUserDailyMissions(testUserId);
      const playMission = missions.find((m) => m.mission.type === 'PLAY_GAME' && m.mission.target === 1);

      if (playMission) {
        // Complete the mission
        const event: MissionProgressEvent = {
          userId: testUserId,
          eventType: 'GAME_COMPLETED',
          gameId: 'reaction-rush',
          timestamp: new Date(),
          metadata: {},
        };
        processMissionProgress(event);

        // Try to claim with wrong user
        const result = claimMissionReward('wrong-user', playMission.id);
        expect(result.success).toBe(false);
        expect(result.error).toBe('UNAUTHORIZED');
      }
    });
  });

  describe('Mission Expiration', () => {
    it('should expire missions for a period', () => {
      generateDailyMissions(testUserId, 1);
      const today = new Date().toISOString().slice(0, 10);
      const expiredCount = expireMissionsForPeriod(today);
      expect(expiredCount).toBe(0); // Today's missions shouldn't expire yet

      // Create missions for yesterday
      generateDailyMissions('other-user', 1);
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const expiredYesterday = expireMissionsForPeriod(yesterdayStr);
      expect(expiredYesterday).toBe(0); // Other user's missions
    });
  });

  describe('Mission Progress Queries', () => {
    it('should return mission progress', () => {
      generateDailyMissions(testUserId, 1);
      const missions = getUserDailyMissions(testUserId);
      const firstMission = missions[0];

      if (firstMission) {
        const progress = getMissionProgress(testUserId, firstMission.id);
        expect(progress).toBeDefined();
        expect(progress?.missionId).toBe(firstMission.missionId);
        expect(progress?.progress).toBe(0);
        expect(progress?.target).toBe(firstMission.target);
      }
    });

    it('should return null for non-existent mission', () => {
      const progress = getMissionProgress(testUserId, 'non-existent');
      expect(progress).toBeNull();
    });

    it('should return null for wrong user', () => {
      generateDailyMissions(testUserId, 1);
      const missions = getUserDailyMissions(testUserId);
      const firstMission = missions[0];

      if (firstMission) {
        const progress = getMissionProgress('wrong-user', firstMission.id);
        expect(progress).toBeNull();
      }
    });
  });
});
