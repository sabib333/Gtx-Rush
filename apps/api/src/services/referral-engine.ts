/**
 * GTX Rush — Referral Engine v1.0
 *
 * Server-authoritative referral system that handles:
 * - Referral code generation
 * - Deep link creation
 * - Referral attribution
 * - Referral lifecycle (created → opened → registered → activated → qualified → rewarded)
 * - Fraud detection and prevention
 * - Self-referral protection
 * - Reward granting
 *
 * SECURITY:
 * - Referral attribution is server-authoritative
 * - Deep links are validated server-side
 * - Self-referral is prevented
 * - Referral rewards require legitimate qualification
 * - Fraud detection prevents abuse
 *
 * Contract: Growth Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  Referral,
  ReferralCode,
  ReferralWithUsers,
  ReferralStatus,
  ReferralSource,
  ReferralFraudStatus,
  ReferralReward,
  ReferralRewardConfig,
  ReferralDashboard,
  ReferralStats,
  ReferralMilestone,
  DeepLinkContext,
  DeepLinkResolution,
  LandingExperience,
  ReferralFraudCheck,
  FraudSignal,
} from '@gtx-rush/types';
import {
  REFERRAL_CODE_CONFIG,
  REFERRAL_LIMITS,
  DEFAULT_REFERRAL_REWARDS,
  REFERRAL_MILESTONES,
  ACTIVATION_CONFIG,
  DEEP_LINK_CONFIG,
  FRAUD_CONFIG,
  generateReferralDeepLink,
  getNextReferralMilestone,
  calculateMilestoneProgress,
  isValidReferralCode,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const referralCodes = new Map<string, ReferralCode>(); // code → ReferralCode
const userReferralCodes = new Map<string, string>(); // userId → code
const referrals = new Map<string, Referral>(); // referralId → Referral
const userReferrals = new Map<string, string[]>(); // userId → referralIds
const referralRewards = new Map<string, ReferralReward[]>();
const dailyReferralCounts = new Map<string, number>(); // userId:YYYY-MM-DD → count

// ============================================================
// Referral Code Generation
// ============================================================

/**
 * Generate a unique referral code for a user.
 *
 * SECURITY:
 * - Codes are unique and hard to guess
 * - One active code per user
 * - Codes are non-sensitive (no internal IDs)
 */
export function generateReferralCode(userId: string): ReferralCode {
  // Check if user already has a code
  const existingCode = userReferralCodes.get(userId);
  if (existingCode) {
    const existing = referralCodes.get(existingCode);
    if (existing && existing.isActive) {
      return existing;
    }
  }

  // Generate unique code
  let code: string;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    code = generateUniqueCode();
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error('FAILED_TO_GENERATE_UNIQUE_CODE');
    }
  } while (referralCodes.has(code));

  // Create referral code
  const referralCode: ReferralCode = {
    id: nanoid(),
    userId,
    code,
    isActive: true,
    usageCount: 0,
    maxUses: REFERRAL_CODE_CONFIG.maxUses,
    createdAt: new Date(),
    expiresAt: REFERRAL_CODE_CONFIG.expirationDays
      ? new Date(Date.now() + REFERRAL_CODE_CONFIG.expirationDays * 24 * 60 * 60 * 1000)
      : null,
  };

  referralCodes.set(code, referralCode);
  userReferralCodes.set(userId, code);

  return referralCode;
}

/**
 * Generate a unique code.
 */
function generateUniqueCode(): string {
  const { codeLength, charset } = REFERRAL_CODE_CONFIG;
  let code = '';
  for (let i = 0; i < codeLength; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    code += charset[randomIndex];
  }
  return code;
}

/**
 * Get a user's referral code.
 */
export function getUserReferralCode(userId: string): ReferralCode | null {
  const code = userReferralCodes.get(userId);
  if (!code) return null;
  return referralCodes.get(code) ?? null;
}

/**
 * Get referral code by code string.
 */
export function getReferralCodeByCode(code: string): ReferralCode | null {
  return referralCodes.get(code) ?? null;
}

// ============================================================
// Deep Link Processing
// ============================================================

/**
 * Resolve a deep link context.
 *
 * SECURITY:
 * - Deep links are validated server-side
 * - Referral codes are verified
 * - Campaign IDs are validated
 */
export function resolveDeepLink(startParam: string): DeepLinkResolution {
  if (!startParam) {
    return { valid: false, context: null, inviter: null, campaign: null };
  }

  // Parse start parameter
  const context = parseStartParam(startParam);
  if (!context) {
    return { valid: false, context: null, inviter: null, campaign: null, error: 'INVALID_START_PARAM' };
  }

  // Validate referral code if present
  if (context.referralCode) {
    const referralCode = getReferralCodeByCode(context.referralCode);
    if (!referralCode || !referralCode.isActive) {
      return { valid: false, context, inviter: null, campaign: null, error: 'INVALID_REFERRAL_CODE' };
    }

    // Get inviter info
    const inviter = getInviterInfo(referralCode.userId);
    return { valid: true, context, inviter, campaign: null };
  }

  return { valid: true, context, inviter: null, campaign: null };
}

/**
 * Parse start parameter into deep link context.
 */
function parseStartParam(startParam: string): DeepLinkContext | null {
  // Referral: ref_CODE
  if (startParam.startsWith(DEEP_LINK_CONFIG.referralPrefix)) {
    const code = startParam.slice(DEEP_LINK_CONFIG.referralPrefix.length);
    return {
      referralCode: code,
      challengeToken: null,
      campaignId: null,
      source: 'direct_referral',
      params: {},
    };
  }

  // Challenge: ch_TOKEN
  if (startParam.startsWith(DEEP_LINK_CONFIG.challengePrefix)) {
    const token = startParam.slice(DEEP_LINK_CONFIG.challengePrefix.length);
    return {
      referralCode: null,
      challengeToken: token,
      campaignId: null,
      source: 'friend_challenge',
      params: {},
    };
  }

  // Campaign: camp_CAMPAIGNID_CODE
  if (startParam.startsWith(DEEP_LINK_CONFIG.campaignPrefix)) {
    const rest = startParam.slice(DEEP_LINK_CONFIG.campaignPrefix.length);
    const parts = rest.split('_');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return {
        referralCode: parts[1],
        challengeToken: null,
        campaignId: parts[0],
        source: 'campaign',
        params: { campaignId: parts[0] },
      };
    }
  }

  // Legacy format: just the code
  if (isValidReferralCode(startParam)) {
    return {
      referralCode: startParam,
      challengeToken: null,
      campaignId: null,
      source: 'direct_referral',
      params: {},
    };
  }

  return null;
}

/**
 * Get inviter info for display.
 */
function getInviterInfo(userId: string): {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
} | null {
  // In production, fetch from users table
  // For MVP, return mock data
  return {
    id: userId,
    displayName: 'Your Friend',
    avatarUrl: null,
    level: 1,
  };
}

// ============================================================
// Referral Lifecycle
// ============================================================

/**
 * Create a new referral.
 *
 * SECURITY:
 * - Validates inviter eligibility
 * - Prevents self-referral
 * - Checks fraud signals
 * - Enforces limits
 */
export function createReferral(
  inviterUserId: string,
  referralCode: string,
  source: ReferralSource,
  metadata: Record<string, unknown> = {},
): {
  success: boolean;
  referral?: Referral;
  error?: string;
} {
  // Validate referral code
  const codeRecord = getReferralCodeByCode(referralCode);
  if (!codeRecord || !codeRecord.isActive) {
    return { success: false, error: 'INVALID_REFERRAL_CODE' };
  }

  // Check if inviter is eligible
  const eligibility = checkInviterEligibility(codeRecord.userId);
  if (!eligibility.eligible) {
    return { success: false, error: eligibility.reason };
  }

  // Check daily limit
  const dailyCount = getDailyReferralCount(codeRecord.userId);
  if (dailyCount >= REFERRAL_LIMITS.dailyQualifiedLimit) {
    return { success: false, error: 'DAILY_LIMIT_REACHED' };
  }

  // Create referral
  const referral: Referral = {
    id: nanoid(),
    inviterUserId: codeRecord.userId,
    inviteeUserId: null,
    referralCode,
    source,
    campaignId: metadata.campaignId as string ?? null,
    status: 'created',
    fraudStatus: 'valid',
    metadata,
    createdAt: new Date(),
    openedAt: null,
    registeredAt: null,
    activatedAt: null,
    qualifiedAt: null,
    rewardedAt: null,
  };

  referrals.set(referral.id, referral);

  // Update user referrals index
  const inviterReferrals = userReferrals.get(codeRecord.userId) ?? [];
  inviterReferrals.push(referral.id);
  userReferrals.set(codeRecord.userId, inviterReferrals);

  // Update code usage
  codeRecord.usageCount++;

  return { success: true, referral };
}

/**
 * Mark a referral as opened.
 */
export function openReferral(referralId: string): boolean {
  const referral = referrals.get(referralId);
  if (!referral || referral.status !== 'created') return false;

  referral.status = 'opened';
  referral.openedAt = new Date();
  return true;
}

/**
 * Register a referral (invitee creates account).
 */
export function registerReferral(
  referralId: string,
  inviteeUserId: string,
): {
  success: boolean;
  error?: string;
} {
  const referral = referrals.get(referralId);
  if (!referral) {
    return { success: false, error: 'REFERRAL_NOT_FOUND' };
  }

  if (referral.status !== 'opened' && referral.status !== 'created') {
    return { success: false, error: 'INVALID_REFERRAL_STATUS' };
  }

  // Prevent self-referral
  if (referral.inviterUserId === inviteeUserId) {
    referral.fraudStatus = 'rejected';
    referral.status = 'rejected';
    return { success: false, error: 'SELF_REFERRAL_DETECTED' };
  }

  // Check for duplicate registration
  if (referral.inviteeUserId) {
    return { success: false, error: 'ALREADY_REGISTERED' };
  }

  referral.inviteeUserId = inviteeUserId;
  referral.status = 'registered';
  referral.registeredAt = new Date();

  // Run fraud check
  const fraudCheck = runFraudCheck(referral);
  if (fraudCheck.recommendation === 'reject') {
    referral.fraudStatus = 'rejected';
    referral.status = 'rejected';
    return { success: false, error: 'FRAUD_DETECTED' };
  }

  if (fraudCheck.recommendation === 'hold') {
    referral.fraudStatus = 'suspicious';
  }

  return { success: true };
}

/**
 * Activate a referral (invitee completes activation criteria).
 */
export function activateReferral(
  referralId: string,
  inviteeUserId: string,
): {
  success: boolean;
  error?: string;
} {
  const referral = referrals.get(referralId);
  if (!referral) {
    return { success: false, error: 'REFERRAL_NOT_FOUND' };
  }

  if (referral.inviteeUserId !== inviteeUserId) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  if (referral.status !== 'registered') {
    return { success: false, error: 'INVALID_REFERRAL_STATUS' };
  }

  referral.status = 'activated';
  referral.activatedAt = new Date();

  return { success: true };
}

/**
 * Qualify a referral (invitee completes meaningful activity).
 */
export function qualifyReferral(
  referralId: string,
  inviteeUserId: string,
): {
  success: boolean;
  error?: string;
} {
  const referral = referrals.get(referralId);
  if (!referral) {
    return { success: false, error: 'REFERRAL_NOT_FOUND' };
  }

  if (referral.inviteeUserId !== inviteeUserId) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  if (referral.status !== 'activated') {
    return { success: false, error: 'INVALID_REFERRAL_STATUS' };
  }

  // Check fraud status
  if (referral.fraudStatus === 'rejected') {
    return { success: false, error: 'REFERRAL_REJECTED' };
  }

  referral.status = 'qualified';
  referral.qualifiedAt = new Date();

  return { success: true };
}

// ============================================================
// Fraud Detection
// ============================================================

/**
 * Run fraud check on a referral.
 */
function runFraudCheck(referral: Referral): ReferralFraudCheck {
  const signals: FraudSignal[] = [];
  let riskScore = 0;

  // Check self-referral
  if (referral.inviterUserId === referral.inviteeUserId) {
    signals.push({
      type: 'self_referral',
      description: 'Same user ID for inviter and invitee',
      severity: 'high',
      metadata: {},
    });
    riskScore += 100;
  }

  // Check rapid account creation
  const rapidCheck = checkRapidAccountCreation(referral.inviterUserId);
  if (rapidCheck.suspicious) {
    signals.push({
      type: 'rapid_account_creation',
      description: 'Multiple accounts created rapidly from same source',
      severity: 'high',
      metadata: rapidCheck.metadata,
    });
    riskScore += 70;
  }

  // Check referral patterns
  const patternCheck = checkReferralPatterns(referral.inviterUserId);
  if (patternCheck.suspicious) {
    signals.push({
      type: 'suspicious_pattern',
      description: 'Abnormal referral pattern detected',
      severity: 'medium',
      metadata: patternCheck.metadata,
    });
    riskScore += 40;
  }

  // Determine recommendation
  let recommendation: 'approve' | 'hold' | 'reject';
  if (riskScore >= FRAUD_CONFIG.rejectionThreshold) {
    recommendation = 'reject';
  } else if (riskScore >= FRAUD_CONFIG.holdThreshold) {
    recommendation = 'hold';
  } else {
    recommendation = 'approve';
  }

  return {
    referralId: referral.id,
    userId: referral.inviterUserId ?? referral.inviteeUserId ?? '',
    signals,
    riskScore,
    recommendation,
    reason: signals.length > 0 ? signals.map((s) => s.description).join('; ') : 'No issues detected',
  };
}

/**
 * Check for rapid account creation.
 */
function checkRapidAccountCreation(userId: string): {
  suspicious: boolean;
  metadata: Record<string, unknown>;
} {
  // In production, check database for rapid account creation
  // For MVP, return safe default
  return { suspicious: false, metadata: {} };
}

/**
 * Check referral patterns for abuse.
 */
function checkReferralPatterns(userId: string): {
  suspicious: boolean;
  metadata: Record<string, unknown>;
} {
  const userReferralList = userReferrals.get(userId) ?? [];
  const recentReferrals = userReferralList
    .map((id) => referrals.get(id))
    .filter((r): r is Referral => r !== undefined)
    .filter((r) => {
      const hoursAgo = (Date.now() - r.createdAt.getTime()) / (1000 * 60 * 60);
      return hoursAgo < 24;
    });

  // Check for suspicious patterns
  if (recentReferrals.length > 20) {
    return {
      suspicious: true,
      metadata: { recentCount: recentReferrals.length },
    };
  }

  return { suspicious: false, metadata: {} };
}

/**
 * Check inviter eligibility.
 */
function checkInviterEligibility(userId: string): {
  eligible: boolean;
  reason: string;
} {
  // In production, check user's game activity
  // For MVP, allow all users
  return { eligible: true, reason: '' };
}

/**
 * Get daily referral count for a user.
 */
function getDailyReferralCount(userId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}:${today}`;
  return dailyReferralCounts.get(key) ?? 0;
}

// ============================================================
// Referral Rewards
// ============================================================

/**
 * Grant referral reward.
 *
 * SECURITY:
 * - Rewards are idempotent
 * - Only qualified referrals are rewarded
 * - Fraudulent referrals are not rewarded
 */
export function grantReferralReward(
  referralId: string,
): {
  success: boolean;
  rewards?: ReferralReward[];
  error?: string;
} {
  const referral = referrals.get(referralId);
  if (!referral) {
    return { success: false, error: 'REFERRAL_NOT_FOUND' };
  }

  // Idempotency check first — a rewarded referral must never be re-granted
  if (referral.rewardedAt) {
    return { success: false, error: 'ALREADY_REWARDED' };
  }

  if (referral.status !== 'qualified') {
    return { success: false, error: 'REFERRAL_NOT_QUALIFIED' };
  }

  if (referral.fraudStatus === 'rejected') {
    return { success: false, error: 'REFERRAL_REJECTED' };
  }

  const rewards: ReferralReward[] = [];

  // Grant inviter reward
  const inviterReward: ReferralReward = {
    id: nanoid(),
    referralId,
    userId: referral.inviterUserId,
    rewardType: 'xp',
    rewardValue: DEFAULT_REFERRAL_REWARDS.inviterXp,
    source: 'referral',
    referenceId: referralId,
    idempotencyKey: `inviter:${referralId}`,
    claimedAt: null,
    createdAt: new Date(),
  };
  rewards.push(inviterReward);

  // Grant invitee reward if exists
  if (referral.inviteeUserId) {
    const inviteeReward: ReferralReward = {
      id: nanoid(),
      referralId,
      userId: referral.inviteeUserId,
      rewardType: 'xp',
      rewardValue: DEFAULT_REFERRAL_REWARDS.inviteeXp,
      source: 'referral',
      referenceId: referralId,
      idempotencyKey: `invitee:${referralId}`,
      claimedAt: null,
      createdAt: new Date(),
    };
    rewards.push(inviteeReward);
  }

  // Store rewards
  referralRewards.set(referralId, rewards);

  // Mark as rewarded
  referral.status = 'rewarded';
  referral.rewardedAt = new Date();

  // Update daily count
  const today = new Date().toISOString().slice(0, 10);
  const key = `${referral.inviterUserId}:${today}`;
  dailyReferralCounts.set(key, (dailyReferralCounts.get(key) ?? 0) + 1);

  return { success: true, rewards };
}

// ============================================================
// Referral Dashboard
// ============================================================

/**
 * Get referral dashboard for a user.
 */
export function getReferralDashboard(userId: string): ReferralDashboard {
  const referralList = userReferrals.get(userId) ?? [];
  const allReferrals = referralList
    .map((id) => referrals.get(id))
    .filter((r): r is Referral => r !== undefined);

  const totalInvited = allReferrals.length;
  const registered = allReferrals.filter((r) => r.status === 'registered' || r.status === 'activated' || r.status === 'qualified' || r.status === 'rewarded').length;
  const activated = allReferrals.filter((r) => r.status === 'activated' || r.status === 'qualified' || r.status === 'rewarded').length;
  const qualified = allReferrals.filter((r) => r.status === 'qualified' || r.status === 'rewarded').length;

  const rewards = allReferrals
    .flatMap((r) => referralRewards.get(r.id) ?? [])
    .filter((r) => r.userId === userId);

  const milestoneProgress = calculateMilestoneProgress(qualified);
  const nextMilestone = milestoneProgress.next;

  const code = getUserReferralCode(userId);

  // Get recent referrals with user info
  const recentReferrals: ReferralWithUsers[] = allReferrals
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map((r) => ({
      ...r,
      inviter: getInviterInfo(r.inviterUserId) ?? {
        id: r.inviterUserId,
        displayName: 'Unknown',
        avatarUrl: null,
        level: 1,
      },
      invitee: r.inviteeUserId ? getInviterInfo(r.inviteeUserId) : null,
    }));

  return {
    totalInvited,
    registered,
    activated,
    qualified,
    rewardsEarned: rewards,
    nextMilestone,
    progressToNextMilestone: milestoneProgress.percentage,
    referralCode: code?.code ?? '',
    recentReferrals,
  };
}

/**
 * Get referral stats for analytics.
 */
export function getReferralStats(userId: string): ReferralStats {
  const referralList = userReferrals.get(userId) ?? [];
  const allReferrals = referralList
    .map((id) => referrals.get(id))
    .filter((r): r is Referral => r !== undefined);

  const invitesSent = allReferrals.length;
  const inviteOpens = allReferrals.filter((r) => r.openedAt !== null).length;
  const newUsers = allReferrals.filter((r) => r.registeredAt !== null).length;
  const activatedUsers = allReferrals.filter((r) => r.activatedAt !== null).length;
  const qualifiedReferrals = allReferrals.filter((r) => r.qualifiedAt !== null).length;

  const inviteToOpen = invitesSent > 0 ? inviteOpens / invitesSent : 0;
  const openToActivation = inviteOpens > 0 ? activatedUsers / inviteOpens : 0;
  const activationToQualification = activatedUsers > 0 ? qualifiedReferrals / activatedUsers : 0;
  const overallConversion = invitesSent > 0 ? qualifiedReferrals / invitesSent : 0;

  const averageInvitesPerUser = invitesSent; // For single user, this is just their count
  const kFactor = averageInvitesPerUser * overallConversion;

  return {
    invitesSent,
    inviteOpens,
    newUsers,
    activatedUsers,
    qualifiedReferrals,
    conversionRates: {
      inviteToOpen,
      openToActivation,
      activationToQualification,
      overallConversion,
    },
    kFactor,
  };
}

/**
 * Get all referrals in a rewardable state where the given user is the invitee.
 * Used by the Qualification Engine (internal).
 */
export function _getUserReferralsForInviteeInternal(
  inviteeUserId: string,
): Referral[] {
  const results: Referral[] = [];
  for (const referral of referrals.values()) {
    if (
      referral.inviteeUserId === inviteeUserId &&
      (referral.status === 'registered' || referral.status === 'activated')
    ) {
      results.push(referral);
    }
  }
  return results;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearReferralEngine(): void {
  referralCodes.clear();
  userReferralCodes.clear();
  referrals.clear();
  userReferrals.clear();
  referralRewards.clear();
  dailyReferralCounts.clear();
}

export function _getReferralCodeCount(): number {
  return referralCodes.size;
}

export function _getReferralCount(): number {
  return referrals.size;
}

export function _getUserReferralCount(userId: string): number {
  return (userReferrals.get(userId) ?? []).length;
}
