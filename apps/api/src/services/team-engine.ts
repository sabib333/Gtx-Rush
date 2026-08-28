/**
 * GTX Rush — Team Engine v1.0
 *
 * Server-authoritative team system that handles:
 * - Team creation and management
 * - Team membership and roles
 * - Team XP and leveling
 * - Team invites and join requests
 * - Team leaderboards
 *
 * SECURITY:
 * - Team permissions are server-authoritative
 * - Role-based access control
 * - Invite codes are validated
 * - XP is auditable
 *
 * Contract: Social Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  Team,
  TeamMember,
  TeamMemberWithProfile,
  TeamInvite,
  TeamJoinRequest,
  TeamRole,
  TeamPrivacy,
  TeamXpTransaction,
  TeamXpSource,
  TeamSettings,
  TeamMetadata,
  TeamLeaderboardEntry,
  FriendProfile,
} from '@gtx-rush/types';
import {
  TEAM_CONFIG,
  TEAM_ROLE_PERMISSIONS,
  TEAM_XP_CONFIG,
  getTeamLevelFromXp,
  generateTeamInviteCode,
  hasTeamPermission,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const teams = new Map<string, Team>();
const teamMembers = new Map<string, TeamMember>(); // teamId:userId → member
const teamMemberSets = new Map<string, Set<string>>(); // teamId → Set of userIds
const userTeams = new Map<string, string>(); // userId → teamId
const teamInvites = new Map<string, TeamInvite>(); // inviteId → invite
const teamInviteByCode = new Map<string, TeamInvite>(); // code → invite
const teamJoinRequests = new Map<string, TeamJoinRequest>(); // requestId → request
const teamXpTransactions = new Map<string, TeamXpTransaction[]>();
const teamDailyXp = new Map<string, number>(); // teamId:source:YYYY-MM-DD → amount

// ============================================================
// Team Management
// ============================================================

/**
 * Create a new team.
 *
 * SECURITY:
 * - Validates team name and tag
 * - Prevents duplicate teams per user
 * - Server-authoritative creation
 */
export function createTeam(
  userId: string,
  params: {
    name: string;
    tag: string;
    description?: string;
    privacy?: TeamPrivacy;
    maxMembers?: number;
  },
): {
  success: boolean;
  team?: Team;
  error?: string;
} {
  // Validate name length
  if (params.name.length < TEAM_CONFIG.minNameLength || params.name.length > TEAM_CONFIG.maxNameLength) {
    return { success: false, error: 'INVALID_NAME_LENGTH' };
  }

  // Validate tag length
  if (params.tag.length < TEAM_CONFIG.minTagLength || params.tag.length > TEAM_CONFIG.maxTagLength) {
    return { success: false, error: 'INVALID_TAG_LENGTH' };
  }

  // Check if user already has a team
  if (userTeams.has(userId)) {
    return { success: false, error: 'ALREADY_IN_TEAM' };
  }

  // Create team
  const teamId = nanoid();
  const team: Team = {
    id: teamId,
    name: params.name,
    tag: params.tag,
    description: params.description ?? '',
    avatarUrl: null,
    ownerId: userId,
    privacy: params.privacy ?? 'public',
    status: 'active',
    maxMembers: params.maxMembers ?? TEAM_CONFIG.defaultMaxMembers,
    currentMembers: 1,
    teamLevel: 1,
    teamXp: 0,
    teamRank: null,
    seasonRank: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      theme: null,
      badges: [],
      settings: {
        allowJoinRequests: true,
        requireApproval: params.privacy === 'private',
        defaultRole: 'member',
        maxInvites: TEAM_CONFIG.maxInvitesPerDay,
      },
    },
  };

  teams.set(teamId, team);

  // Add owner as member
  addMemberToTeam(teamId, userId, 'owner');

  return { success: true, team };
}

/**
 * Get a team by ID.
 */
export function getTeam(teamId: string): Team | null {
  return teams.get(teamId) ?? null;
}

/**
 * Get user's team.
 */
export function getUserTeam(userId: string): Team | null {
  const teamId = userTeams.get(userId);
  if (!teamId) return null;
  return teams.get(teamId) ?? null;
}

/**
 * Update team details.
 */
export function updateTeam(
  teamId: string,
  userId: string,
  updates: Partial<{
    name: string;
    tag: string;
    description: string;
    privacy: TeamPrivacy;
    avatarUrl: string;
  }>,
): {
  success: boolean;
  team?: Team;
  error?: string;
} {
  const team = teams.get(teamId);
  if (!team) {
    return { success: false, error: 'TEAM_NOT_FOUND' };
  }

  // Check permissions
  const memberRole = getMemberRole(teamId, userId);
  if (!memberRole || !hasTeamPermission(memberRole, 'edit_team')) {
    return { success: false, error: 'INSUFFICIENT_PERMISSIONS' };
  }

  // Apply updates
  if (updates.name !== undefined) team.name = updates.name;
  if (updates.tag !== undefined) team.tag = updates.tag;
  if (updates.description !== undefined) team.description = updates.description;
  if (updates.privacy !== undefined) team.privacy = updates.privacy;
  if (updates.avatarUrl !== undefined) team.avatarUrl = updates.avatarUrl;

  team.updatedAt = new Date();

  return { success: true, team };
}

/**
 * Disband a team.
 */
export function disbandTeam(
  teamId: string,
  userId: string,
): {
  success: boolean;
  error?: string;
} {
  const team = teams.get(teamId);
  if (!team) {
    return { success: false, error: 'TEAM_NOT_FOUND' };
  }

  const disbandRole = getMemberRole(teamId, userId);
  if (!disbandRole || !hasTeamPermission(disbandRole, 'disband_team')) {
    return { success: false, error: 'INSUFFICIENT_PERMISSIONS' };
  }

  // Remove all members
  const members = teamMemberSets.get(teamId) ?? new Set();
  for (const memberId of members) {
    userTeams.delete(memberId);
  }

  // Update team status
  team.status = 'disbanded';
  team.updatedAt = new Date();

  return { success: true };
}

// ============================================================
// Team Membership
// ============================================================

/**
 * Add a member to a team.
 */
function addMemberToTeam(teamId: string, userId: string, role: TeamRole): TeamMember {
  const member: TeamMember = {
    id: nanoid(),
    teamId,
    userId,
    role,
    contributionXp: 0,
    contributionGames: 0,
    contributionEvents: 0,
    joinedAt: new Date(),
    lastActiveAt: new Date(),
    status: 'active',
  };

  teamMembers.set(`${teamId}:${userId}`, member);

  const members = teamMemberSets.get(teamId) ?? new Set();
  members.add(userId);
  teamMemberSets.set(teamId, members);

  userTeams.set(userId, teamId);

  // Update team member count
  const team = teams.get(teamId);
  if (team) {
    team.currentMembers = members.size;
  }

  return member;
}

/**
 * Remove a member from a team.
 */
export function removeMember(
  teamId: string,
  userId: string,
  targetUserId: string,
): {
  success: boolean;
  error?: string;
} {
  const team = teams.get(teamId);
  if (!team) {
    return { success: false, error: 'TEAM_NOT_FOUND' };
  }

  // Check permissions (can remove self or others with permission)
  if (userId !== targetUserId) {
  const removeRole = getMemberRole(teamId, userId);
  if (!removeRole || !hasTeamPermission(removeRole, 'remove_members')) {
    return { success: false, error: 'INSUFFICIENT_PERMISSIONS' };
  }
  }

  const targetRole = getMemberRole(teamId, targetUserId);
  if (!targetRole) {
    return { success: false, error: 'NOT_A_MEMBER' };
  }

  // Owner cannot be removed (must transfer ownership first)
  if (targetRole === 'owner' && userId !== targetUserId) {
    return { success: false, error: 'CANNOT_REMOVE_OWNER' };
  }

  // Remove member
  teamMembers.delete(`${teamId}:${targetUserId}`);

  const members = teamMemberSets.get(teamId);
  members?.delete(targetUserId);

  userTeams.delete(targetUserId);

  // Update team member count
  team.currentMembers = members?.size ?? 0;

  return { success: true };
}

/**
 * Leave a team.
 */
export function leaveTeam(
  teamId: string,
  userId: string,
): {
  success: boolean;
  error?: string;
} {
  const role = getMemberRole(teamId, userId);
  if (!role) {
    return { success: false, error: 'NOT_A_MEMBER' };
  }

  // Owner cannot leave without transferring ownership
  if (role === 'owner') {
    return { success: false, error: 'OWNER_CANNOT_LEAVE' };
  }

  return removeMember(teamId, userId, userId);
}

/**
 * Get member role.
 */
export function getMemberRole(teamId: string, userId: string): TeamRole | null {
  const member = teamMembers.get(`${teamId}:${userId}`);
  return member?.role ?? null;
}

/**
 * Get team members.
 */
export function getTeamMembers(teamId: string): TeamMemberWithProfile[] {
  const members = teamMemberSets.get(teamId) ?? new Set();
  return Array.from(members)
    .map((userId) => {
      const member = teamMembers.get(`${teamId}:${userId}`);
      if (!member) return null;

      return {
        ...member,
        profile: getTeamMemberProfile(userId),
      };
    })
    .filter((m): m is TeamMemberWithProfile => m !== null);
}

/**
 * Get team member profile.
 */
function getTeamMemberProfile(userId: string): FriendProfile {
  // In production, fetch from users table
  return {
    id: userId,
    displayName: `Player ${userId.slice(0, 8)}`,
    username: `user_${userId.slice(0, 8)}`,
    avatarUrl: null,
    level: 1,
    globalRank: null,
    seasonRank: null,
    tier: null,
    title: null,
    badges: [],
    bestScore: 0,
    currentStreak: 0,
    teamId: userTeams.get(userId) ?? null,
    teamName: null,
  };
}

// ============================================================
// Team Invites
// ============================================================

/**
 * Create a team invite.
 */
export function createTeamInvite(
  teamId: string,
  inviterUserId: string,
  invitedUserId: string | null = null,
  message: string | null = null,
): {
  success: boolean;
  invite?: TeamInvite;
  error?: string;
} {
  const team = teams.get(teamId);
  if (!team) {
    return { success: false, error: 'TEAM_NOT_FOUND' };
  }

  const inviteRole = getMemberRole(teamId, inviterUserId);
  if (!inviteRole || !hasTeamPermission(inviteRole, 'invite_members')) {
    return { success: false, error: 'INSUFFICIENT_PERMISSIONS' };
  }

  // Check if team is full
  if (team.currentMembers >= team.maxMembers) {
    return { success: false, error: 'TEAM_FULL' };
  }

  // Check if user already in team
  if (invitedUserId && userTeams.has(invitedUserId)) {
    return { success: false, error: 'USER_ALREADY_IN_TEAM' };
  }

  // Generate invite code
  let inviteCode = generateTeamInviteCode();
  while (teamInviteByCode.has(inviteCode)) {
    inviteCode = generateTeamInviteCode();
  }

  // Create invite
  const invite: TeamInvite = {
    id: nanoid(),
    teamId,
    invitedBy: inviterUserId,
    invitedUserId,
    inviteCode,
    status: 'pending',
    message,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + TEAM_CONFIG.inviteExpirationDays * 24 * 60 * 60 * 1000),
    respondedAt: null,
  };

  teamInvites.set(invite.id, invite);
  teamInviteByCode.set(inviteCode, invite);

  return { success: true, invite };
}

/**
 * Accept a team invite.
 */
export function acceptTeamInvite(
  userId: string,
  inviteCode: string,
): {
  success: boolean;
  team?: Team;
  error?: string;
} {
  const invite = teamInviteByCode.get(inviteCode);
  if (!invite) {
    return { success: false, error: 'INVITE_NOT_FOUND' };
  }

  if (invite.status !== 'pending') {
    return { success: false, error: 'INVITE_NOT_PENDING' };
  }

  if (new Date() > invite.expiresAt) {
    invite.status = 'expired';
    return { success: false, error: 'INVITE_EXPIRED' };
  }

  if (invite.invitedUserId && invite.invitedUserId !== userId) {
    return { success: false, error: 'INVITE_NOT_FOR_YOU' };
  }

  // Check if user already in a team
  if (userTeams.has(userId)) {
    return { success: false, error: 'ALREADY_IN_TEAM' };
  }

  const team = teams.get(invite.teamId);
  if (!team) {
    return { success: false, error: 'TEAM_NOT_FOUND' };
  }

  if (team.currentMembers >= team.maxMembers) {
    return { success: false, error: 'TEAM_FULL' };
  }

  // Accept invite
  invite.status = 'accepted';
  invite.respondedAt = new Date();

  // Add member
  addMemberToTeam(invite.teamId, userId, 'member');

  return { success: true, team };
}

/**
 * Join a public team.
 */
export function joinTeam(
  teamId: string,
  userId: string,
): {
  success: boolean;
  error?: string;
} {
  const team = teams.get(teamId);
  if (!team) {
    return { success: false, error: 'TEAM_NOT_FOUND' };
  }

  if (team.privacy !== 'public') {
    return { success: false, error: 'TEAM_NOT_PUBLIC' };
  }

  if (userTeams.has(userId)) {
    return { success: false, error: 'ALREADY_IN_TEAM' };
  }

  if (team.currentMembers >= team.maxMembers) {
    return { success: false, error: 'TEAM_FULL' };
  }

  addMemberToTeam(teamId, userId, 'member');

  return { success: true };
}

// ============================================================
// Team XP & Leveling
// ============================================================

/**
 * Award team XP.
 *
 * SECURITY:
 * - XP is auditable
 * - Daily limits enforced
 * - Source tracking
 */
export function awardTeamXp(
  teamId: string,
  userId: string,
  source: TeamXpSource,
  amount: number,
  referenceId: string | null = null,
  referenceType: string | null = null,
): {
  success: boolean;
  xpAwarded: number;
  newTotal: number;
  levelUp: boolean;
  error?: string;
} {
  const team = teams.get(teamId);
  if (!team) {
    return { success: false, xpAwarded: 0, newTotal: 0, levelUp: false, error: 'TEAM_NOT_FOUND' };
  }

  // Check daily limit
  const sourceConfig = TEAM_XP_CONFIG[source];
  const dailyLimit = sourceConfig?.dailyLimit ?? 100;

  const today = new Date().toISOString().slice(0, 10);
  const dailyKey = `${teamId}:${source}:${today}`;
  const currentDaily = teamDailyXp.get(dailyKey) ?? 0;

  if (currentDaily >= dailyLimit) {
    return { success: false, xpAwarded: 0, newTotal: team.teamXp, levelUp: false, error: 'DAILY_LIMIT_REACHED' };
  }

  // Cap amount to daily limit
  const cappedAmount = Math.min(amount, dailyLimit - currentDaily);

  // Award XP
  team.teamXp += cappedAmount;
  team.updatedAt = new Date();

  // Update daily tracking
  teamDailyXp.set(dailyKey, currentDaily + cappedAmount);

  // Record transaction
  const transaction: TeamXpTransaction = {
    id: nanoid(),
    teamId,
    userId,
    amount: cappedAmount,
    source,
    referenceId,
    referenceType,
    createdAt: new Date(),
  };

  const transactions = teamXpTransactions.get(teamId) ?? [];
  transactions.push(transaction);
  teamXpTransactions.set(teamId, transactions);

  // Update member contribution
  const member = teamMembers.get(`${teamId}:${userId}`);
  if (member) {
    member.contributionXp += cappedAmount;
  }

  // Check for level up
  const oldLevel = getTeamLevelFromXp(team.teamXp - cappedAmount);
  const newLevel = getTeamLevelFromXp(team.teamXp);
  const levelUp = newLevel.level > oldLevel.level;

  if (levelUp) {
    team.teamLevel = newLevel.level;
  }

  return {
    success: true,
    xpAwarded: cappedAmount,
    newTotal: team.teamXp,
    levelUp,
  };
}

/**
 * Get team XP transactions.
 */
export function getTeamXpTransactions(
  teamId: string,
  options: { limit?: number; userId?: string } = {},
): TeamXpTransaction[] {
  const { limit = 50, userId } = options;

  const transactions = teamXpTransactions.get(teamId) ?? [];
  let filtered = transactions;

  if (userId) {
    filtered = filtered.filter((t) => t.userId === userId);
  }

  return filtered
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// ============================================================
// Team Leaderboard
// ============================================================

/**
 * Get team leaderboard (member contributions).
 */
export function getTeamLeaderboard(teamId: string): TeamLeaderboardEntry[] {
  const members = teamMemberSets.get(teamId) ?? new Set();

  const entries: TeamLeaderboardEntry[] = [];
  for (const userId of members) {
    const member = teamMembers.get(`${teamId}:${userId}`);
    if (!member) continue;

    entries.push({
      rank: 0,
      userId: member.userId,
      displayName: `Player ${member.userId.slice(0, 8)}`,
      avatarUrl: null,
      level: 1,
      contributionXp: member.contributionXp,
      contributionGames: member.contributionGames,
      contributionEvents: member.contributionEvents,
      isCurrentUser: false,
    });
  }

  return entries
    .sort((a, b) => b.contributionXp - a.contributionXp)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearTeamEngine(): void {
  teams.clear();
  teamMembers.clear();
  teamMemberSets.clear();
  userTeams.clear();
  teamInvites.clear();
  teamInviteByCode.clear();
  teamJoinRequests.clear();
  teamXpTransactions.clear();
  teamDailyXp.clear();
}

export function _getTeamCount(): number {
  return teams.size;
}

export function _getTeamMemberCount(teamId: string): number {
  return teamMemberSets.get(teamId)?.size ?? 0;
}
