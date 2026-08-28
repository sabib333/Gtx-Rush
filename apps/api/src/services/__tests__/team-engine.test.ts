/**
 * GTX Rush — Team Engine Tests
 *
 * Tests for:
 * - Team creation
 * - Team membership
 * - Team invites
 * - Team XP
 * - Team leaderboards
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTeam,
  getTeam,
  getUserTeam,
  updateTeam,
  disbandTeam,
  joinTeam,
  leaveTeam,
  removeMember,
  getMemberRole,
  getTeamMembers,
  createTeamInvite,
  acceptTeamInvite,
  awardTeamXp,
  getTeamXpTransactions,
  getTeamLeaderboard,
  _clearTeamEngine,
  _getTeamCount,
  _getTeamMemberCount,
} from '../team-engine';

describe('Team Engine', () => {
  const testUserId = 'test-user-001';
  const testUserId2 = 'test-user-002';
  const testUserId3 = 'test-user-003';

  beforeEach(() => {
    _clearTeamEngine();
  });

  describe('Team Creation', () => {
    it('should create a team', () => {
      const result = createTeam(testUserId, {
        name: 'Test Team',
        tag: 'TT',
        description: 'A test team',
      });

      expect(result.success).toBe(true);
      expect(result.team).toBeDefined();
      expect(result.team?.name).toBe('Test Team');
      expect(result.team?.tag).toBe('TT');
      expect(result.team?.ownerId).toBe(testUserId);
    });

    it('should add owner as member', () => {
      const result = createTeam(testUserId, {
        name: 'Test Team',
        tag: 'TT',
      });

      const role = getMemberRole(result.team!.id, testUserId);
      expect(role).toBe('owner');
    });

    it('should not create team if user already in one', () => {
      createTeam(testUserId, { name: 'Team 1', tag: 'T1' });
      const result = createTeam(testUserId, { name: 'Team 2', tag: 'T2' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_IN_TEAM');
    });

    it('should validate name length', () => {
      const result = createTeam(testUserId, { name: 'A', tag: 'TT' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_NAME_LENGTH');
    });

    it('should validate tag length', () => {
      const result = createTeam(testUserId, { name: 'Test Team', tag: 'A' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_TAG_LENGTH');
    });
  });

  describe('Team Queries', () => {
    it('should get team by ID', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      const team = getTeam(created.team!.id);
      expect(team).toBeDefined();
      expect(team?.name).toBe('Test Team');
    });

    it('should get user team', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      const userTeam = getUserTeam(testUserId);
      expect(userTeam?.id).toBe(created.team!.id);
    });

    it('should return null for non-existent team', () => {
      const team = getTeam('non-existent');
      expect(team).toBeNull();
    });

    it('should return null for user without team', () => {
      const team = getUserTeam('user-without-team');
      expect(team).toBeNull();
    });
  });

  describe('Team Updates', () => {
    it('should update team details', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      const result = updateTeam(created.team!.id, testUserId, {
        name: 'Updated Team',
        description: 'Updated description',
      });

      expect(result.success).toBe(true);
      expect(result.team?.name).toBe('Updated Team');
    });

    it('should not update team without permission', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      const result = updateTeam(created.team!.id, testUserId2, {
        name: 'Hacked Team',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should disband team', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      const result = disbandTeam(created.team!.id, testUserId);
      expect(result.success).toBe(true);

      const team = getTeam(created.team!.id);
      expect(team?.status).toBe('disbanded');
    });
  });

  describe('Team Membership', () => {
    it('should join a public team', () => {
      const created = createTeam(testUserId, {
        name: 'Public Team',
        tag: 'PT',
        privacy: 'public',
      });

      const result = joinTeam(created.team!.id, testUserId2);
      expect(result.success).toBe(true);

      const role = getMemberRole(created.team!.id, testUserId2);
      expect(role).toBe('member');
    });

    it('should not join private team without invite', () => {
      const created = createTeam(testUserId, {
        name: 'Private Team',
        tag: 'PV',
        privacy: 'private',
      });

      const result = joinTeam(created.team!.id, testUserId2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('TEAM_NOT_PUBLIC');
    });

    it('should leave team', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      joinTeam(created.team!.id, testUserId2);

      const result = leaveTeam(created.team!.id, testUserId2);
      expect(result.success).toBe(true);

      const role = getMemberRole(created.team!.id, testUserId2);
      expect(role).toBeNull();
    });

    it('should not leave as owner', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      const result = leaveTeam(created.team!.id, testUserId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('OWNER_CANNOT_LEAVE');
    });

    it('should get team members', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      joinTeam(created.team!.id, testUserId2);

      const members = getTeamMembers(created.team!.id);
      expect(members.length).toBe(2);
    });
  });

  describe('Team Invites', () => {
    it('should create a team invite', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      const result = createTeamInvite(created.team!.id, testUserId, testUserId2);

      expect(result.success).toBe(true);
      expect(result.invite).toBeDefined();
      expect(result.invite?.inviteCode).toBeDefined();
    });

    it('should accept a team invite', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      const invite = createTeamInvite(created.team!.id, testUserId, testUserId2);

      const result = acceptTeamInvite(testUserId2, invite.invite!.inviteCode);
      expect(result.success).toBe(true);

      const role = getMemberRole(created.team!.id, testUserId2);
      expect(role).toBe('member');
    });

    it('should not accept expired invite', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      const invite = createTeamInvite(created.team!.id, testUserId, testUserId2);

      // Manually expire the invite
      const inviteObj = invite.invite!;
      inviteObj.expiresAt = new Date(Date.now() - 1000);

      const result = acceptTeamInvite(testUserId2, inviteObj.inviteCode);
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVITE_EXPIRED');
    });
  });

  describe('Team XP', () => {
    it('should award team XP', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      const result = awardTeamXp(created.team!.id, testUserId, 'game_play', 10);

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(10);
      expect(result.newTotal).toBe(10);
    });

    it('should track daily XP limit', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });

      // Award up to daily limit
      for (let i = 0; i < 10; i++) {
        awardTeamXp(created.team!.id, testUserId, 'game_play', 5);
      }

      // Try to exceed daily limit
      const result = awardTeamXp(created.team!.id, testUserId, 'game_play', 100);
      expect(result.success).toBe(false);
      expect(result.error).toBe('DAILY_LIMIT_REACHED');
    });

    it('should update member contribution', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      awardTeamXp(created.team!.id, testUserId, 'game_play', 10);

      const members = getTeamMembers(created.team!.id);
      const owner = members.find((m) => m.userId === testUserId);
      expect(owner?.contributionXp).toBe(10);
    });

    it('should detect level up', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      const result = awardTeamXp(created.team!.id, testUserId, 'game_play', 500);
      expect(result.levelUp).toBe(true);
    });

    it('should get XP transactions', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      awardTeamXp(created.team!.id, testUserId, 'game_play', 10);
      awardTeamXp(created.team!.id, testUserId, 'game_win', 20);

      const transactions = getTeamXpTransactions(created.team!.id);
      expect(transactions.length).toBe(2);
    });
  });

  describe('Team Leaderboard', () => {
    it('should get team leaderboard', () => {
      const created = createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      joinTeam(created.team!.id, testUserId2);

      awardTeamXp(created.team!.id, testUserId, 'game_play', 100);
      awardTeamXp(created.team!.id, testUserId2, 'game_play', 200);

      const leaderboard = getTeamLeaderboard(created.team!.id);
      expect(leaderboard.length).toBe(2);
      expect(leaderboard[0].userId).toBe(testUserId2); // Higher XP first
    });
  });

  describe('Cleanup', () => {
    it('should clear team engine', () => {
      createTeam(testUserId, { name: 'Test Team', tag: 'TT' });
      _clearTeamEngine();
      expect(_getTeamCount()).toBe(0);
    });
  });
});
