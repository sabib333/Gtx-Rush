/**
 * GTX Rush — Admin Command Center Types v1.0
 *
 * Type definitions for the admin system including roles, permissions,
 * audit logging, moderation, fraud, experiments, feature flags, and
 * all admin-specific interfaces.
 *
 * Contract: Admin Command Center Contract v1.0
 */

// ============================================================
// Admin Roles & Permissions
// ============================================================

export type AdminCommandCenterRole =
  | 'super_admin'
  | 'ops_admin'
  | 'game_admin'
  | 'content_admin'
  | 'moderator'
  | 'analyst'
  | 'finance_viewer'
  | 'support_agent';

export type AdminPermission =
  // Dashboard
  | 'dashboard.view'
  | 'dashboard.realtime_status'
  // Users
  | 'users.search'
  | 'users.view'
  | 'users.restrict'
  | 'users.suspend'
  | 'users.restore'
  | 'users.view_rewards'
  | 'users.view_reports'
  // Games
  | 'games.view'
  | 'games.enable'
  | 'games.disable'
  | 'games.maintenance'
  | 'games.configure'
  | 'games.view_config_versions'
  // Events
  | 'events.view'
  | 'events.create'
  | 'events.edit_draft'
  | 'events.schedule'
  | 'events.start'
  | 'events.pause'
  | 'events.end'
  | 'events.rollback'
  // Leaderboards
  | 'leaderboards.view'
  | 'leaderboards.inspect'
  | 'leaderboards.freeze'
  | 'leaderboards.correct'
  // Fraud
  | 'fraud.view'
  | 'fraud.mark_review'
  | 'fraud.freeze_reward'
  | 'fraud.restrict'
  | 'fraud.suspend'
  | 'fraud.clear_flag'
  // Moderation
  | 'moderation.view'
  | 'moderation.review'
  | 'moderation.action'
  // Economy
  | 'economy.view'
  | 'economy.inspect_transactions'
  | 'economy.adjust_reward'
  // Payments
  | 'payments.view'
  // Analytics
  | 'analytics.view'
  | 'analytics.export'
  // Experiments
  | 'experiments.view'
  | 'experiments.create'
  | 'experiments.update'
  | 'experiments.pause'
  | 'experiments.complete'
  // AI Center
  | 'ai.view'
  | 'ai.manage'
  | 'ai.review'
  // Feature Flags
  | 'features.view'
  | 'features.toggle'
  | 'features.configure'
  // Emergency Controls
  | 'emergency.view'
  | 'emergency.activate_kill_switch'
  // Alerts
  | 'alerts.view'
  | 'alerts.create'
  | 'alerts.acknowledge'
  // Audit
  | 'audit.view'
  // Marketplace
  | 'market.view'
  | 'market.manage'
  | 'market.moderate'
  // Admin Management
  | 'admin.manage_roles'
  | 'admin.view_sessions'
  | 'admin.revoke_sessions'
  // LiveOps
  | 'liveops.view'
  | 'liveops.manage';

// ============================================================
// Permission Matrix
// ============================================================

export const ROLE_PERMISSIONS: Record<AdminCommandCenterRole, AdminPermission[]> = {
  super_admin: [
    'dashboard.view', 'dashboard.realtime_status',
    'users.search', 'users.view', 'users.restrict', 'users.suspend', 'users.restore',
    'users.view_rewards', 'users.view_reports',
    'games.view', 'games.enable', 'games.disable', 'games.maintenance', 'games.configure',
    'games.view_config_versions',
    'events.view', 'events.create', 'events.edit_draft', 'events.schedule',
    'events.start', 'events.pause', 'events.end', 'events.rollback',
    'leaderboards.view', 'leaderboards.inspect', 'leaderboards.freeze', 'leaderboards.correct',
    'fraud.view', 'fraud.mark_review', 'fraud.freeze_reward', 'fraud.restrict',
    'fraud.suspend', 'fraud.clear_flag',
    'moderation.view', 'moderation.review', 'moderation.action',
    'economy.view', 'economy.inspect_transactions', 'economy.adjust_reward',
    'payments.view',
    'analytics.view', 'analytics.export',
    'experiments.view', 'experiments.create', 'experiments.update', 'experiments.pause', 'experiments.complete',
    'features.view', 'features.toggle', 'features.configure',
    'emergency.view', 'emergency.activate_kill_switch',
    'alerts.view', 'alerts.create', 'alerts.acknowledge',    'audit.view', 'market.view', 'market.manage', 'market.moderate',
    'admin.manage_roles', 'admin.view_sessions', 'admin.revoke_sessions',
    'liveops.view', 'liveops.manage',
  ],
  ops_admin: [
    'dashboard.view', 'dashboard.realtime_status',
    'users.search', 'users.view', 'users.restrict', 'users.suspend', 'users.restore',
    'users.view_rewards', 'users.view_reports',
    'games.view', 'games.enable', 'games.disable', 'games.maintenance',
    'events.view', 'events.create', 'events.edit_draft', 'events.schedule',
    'events.start', 'events.pause', 'events.end', 'events.rollback',
    'leaderboards.view', 'leaderboards.inspect', 'leaderboards.freeze',
    'fraud.view', 'fraud.mark_review', 'fraud.freeze_reward', 'fraud.restrict', 'fraud.suspend',
    'moderation.view', 'moderation.review', 'moderation.action',
    'economy.view', 'economy.inspect_transactions',
    'payments.view',
    'analytics.view', 'analytics.export',
    'experiments.view',
    'features.view',
    'emergency.view', 'emergency.activate_kill_switch',    'alerts.view', 'alerts.create', 'alerts.acknowledge', 'audit.view',
    'market.view', 'market.manage', 'market.moderate',
    'liveops.view', 'liveops.manage',
  ],
  game_admin: [
    'dashboard.view',
    'users.search', 'users.view',
    'games.view', 'games.enable', 'games.disable', 'games.maintenance', 'games.configure',
    'games.view_config_versions',
    'events.view', 'events.create', 'events.edit_draft', 'events.schedule',
    'events.start', 'events.pause', 'events.end',
    'leaderboards.view', 'leaderboards.inspect',
    'analytics.view',
    'features.view',
  ],
  content_admin: [
    'dashboard.view',
    'users.search', 'users.view',
    'events.view', 'events.create', 'events.edit_draft', 'events.schedule',
    'moderation.view', 'moderation.review', 'moderation.action',
    'features.view',
    'analytics.view',
  ],
  moderator: [
    'dashboard.view',
    'users.search', 'users.view', 'users.view_reports',
    'leaderboards.view', 'leaderboards.inspect',
    'fraud.view', 'fraud.mark_review',
    'moderation.view', 'moderation.review', 'moderation.action',
    'analytics.view',
  ],
  analyst: [
    'dashboard.view', 'dashboard.realtime_status',
    'users.search', 'users.view',
    'games.view',
    'events.view',
    'leaderboards.view',
    'fraud.view',
    'economy.view', 'economy.inspect_transactions',
    'payments.view',
    'analytics.view', 'analytics.export',
    'experiments.view',
    'features.view',
    'audit.view',
  ],
  finance_viewer: [
    'dashboard.view',
    'users.search', 'users.view',
    'payments.view',
    'economy.view', 'economy.inspect_transactions',
    'analytics.view',
  ],
  support_agent: [
    'dashboard.view',
    'users.search', 'users.view', 'users.view_rewards', 'users.view_reports',
    'analytics.view',
  ],
};

// ============================================================
// Admin User
// ============================================================

export interface AdminCommandCenterUser {
  id: string;
  userId: string | null;
  email: string;
  displayName: string;
  role: AdminCommandCenterRole;
  permissions: AdminPermission[];
  isActive: boolean;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserCreateRequest {
  email: string;
  password: string;
  displayName: string;
  role: AdminCommandCenterRole;
  permissions?: AdminPermission[];
}

export interface AdminUserUpdateRequest {
  displayName?: string;
  role?: AdminCommandCenterRole;
  permissions?: AdminPermission[];
  isActive?: boolean;
}

// ============================================================
// Admin Authentication
// ============================================================

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  token?: string;
  admin?: AdminCommandCenterUser;
  error?: string;
}

export interface AdminSession {
  id: string;
  adminUserId: string;
  tokenHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
}

// ============================================================
// Audit Log
// ============================================================

export type AdminAuditAction =
  | 'PRICE_CHANGED'
  | 'EVENT_UPDATED'
  | 'CONTENT_REMOVED'
  | 'USER_SUSPENDED'
  | 'USER_RESTRICTED'
  | 'USER_RESTORED'
  | 'REWARD_REVERSED'
  | 'GAME_ENABLED'
  | 'GAME_DISABLED'
  | 'GAME_MAINTENANCE'
  | 'CONFIG_CHANGED'
  | 'FEATURE_FLAG_TOGGLED'
  | 'EMERGENCY_KILL_SWITCH'
  | 'LEADERBOARD_FROZEN'
  | 'LEADERBOARD_CORRECTION'
  | 'MODERATION_ACTION'
  | 'FRAUD_ACTION'
  | 'REWARD_ADJUSTMENT'
  | 'PAYMENT_INSPECTED'
  | 'DATA_EXPORTED'
  | 'EXPERIMENT_CREATED'
  | 'EXPERIMENT_UPDATED'
  | 'EXPERIMENT_PAUSED'
  | 'EXPERIMENT_COMPLETED'
  | 'ALERT_CREATED'
  | 'ALERT_ACKNOWLEDGED'
  | 'SESSION_REVOKED'
  | 'ROLE_ASSIGNED'
  | 'ROLE_REVOKED'
  | 'ADMIN_LOGIN'
  | 'ADMIN_LOGOUT';

export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  action: AdminAuditAction;
  targetType: string | null;
  targetId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

// ============================================================
// Moderation
// ============================================================

export type AdminModerationStatus = 'new' | 'reviewing' | 'action_taken' | 'resolved' | 'dismissed';
export type AdminModerationAction = 'no_action' | 'warning' | 'content_removed' | 'user_restricted' | 'user_suspended';
export type ModerationTargetType = 'report' | 'creator_content' | 'profile' | 'team_content' | 'challenge';

export interface ModerationCase {
  id: string;
  caseNumber: number;
  targetType: ModerationTargetType;
  targetId: string;
  reportedUserId: string | null;
  reporterUserId: string | null;
  reason: string;
  evidence: Record<string, unknown>;
  status: AdminModerationStatus;
  priority: number;
  assignedTo: string | null;
  resolutionAction: AdminModerationAction | null;
  resolutionReason: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationActionRequest {
  caseId: string;
  action: AdminModerationAction;
  reason: string;
}

// ============================================================
// Fraud
// ============================================================

export type FraudAction = 'mark_review' | 'freeze_reward' | 'restrict' | 'suspend' | 'clear_flag';

export interface FraudCase {
  id: string;
  caseNumber: number;
  userId: string;
  flagType: string;
  severity: string;
  description: string | null;
  evidence: Record<string, unknown>;
  status: string;
  action: string | null;
  actionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface FraudActionRequest {
  caseId: string;
  action: FraudAction;
  reason: string;
}

// ============================================================
// Feature Flags
// ============================================================

export type FeatureFlagStatus = 'active' | 'inactive' | 'draft';

export interface FeatureFlag {
  id: string;
  name: string;
  displayName: string;
  description: string;
  status: FeatureFlagStatus;
  defaultValue: boolean;
  rolloutPercentage: number;
  rolloutStrategy: string;
  targetAudience: {
    countries?: string[];
    minLevel?: number;
    maxLevel?: number;
    userTags?: string[];
  };
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagToggleRequest {
  flagId: string;
  status: FeatureFlagStatus;
  rolloutPercentage?: number;
  reason: string;
}

// ============================================================
// Experiments
// ============================================================

export type AdminExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface AdminExperimentVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, unknown>;
}

export interface AdminExperiment {
  id: string;
  name: string;
  description: string;
  status: AdminExperimentStatus;
  variants: AdminExperimentVariant[];
  audience: {
    percentage: number;
    countries?: string[];
    minLevel?: number;
    maxLevel?: number;
  };
  targetMetric: string | null;
  hypothesis: string | null;
  results: {
    control?: Record<string, number>;
    variants?: Record<string, Record<string, number>>;
    winner?: string;
    confidence?: number;
  } | null;
  createdBy: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Configuration Versions
// ============================================================

export type ConfigDeployStatus = 'draft' | 'scheduled' | 'active' | 'rolled_back';

export interface ConfigVersion {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  config: Record<string, unknown>;
  status: ConfigDeployStatus;
  authorId: string;
  reason: string | null;
  scheduledAt: Date | null;
  deployedAt: Date | null;
  rolledBackAt: Date | null;
  createdAt: Date;
}

// ============================================================
// Alerts
// ============================================================

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface AdminAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: string;
  status: AlertStatus;
  source: string | null;
  metadata: Record<string, unknown>;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

// ============================================================
// Dashboard
// ============================================================

export interface DashboardStats {
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
  returningUsers: number;
  gamesPlayed: number;
  challenges: number;
  activeEvents: number;
  revenue: number;
  starsPurchases: number;
  adRevenue: number;
  reports: number;
  fraudAlerts: number;
}

export interface SystemStatus {
  api: SystemComponentStatus;
  database: SystemComponentStatus;
  cache: SystemComponentStatus;
  queue: SystemComponentStatus;
  payments: SystemComponentStatus;
  analytics: SystemComponentStatus;
  gameServices: SystemComponentStatus;
}

export interface SystemComponentStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastChecked: Date;
  latencyMs: number | null;
  message: string | null;
}

// ============================================================
// Game Management
// ============================================================

export type GameOperationalStatus = 'enabled' | 'disabled' | 'maintenance';

export interface GameManagementConfig {
  gameId: string;
  gameName: string;
  status: GameOperationalStatus;
  config: Record<string, unknown>;
  currentVersion: number;
  lastConfigChange: Date | null;
}

// ============================================================
// Emergency Controls
// ============================================================

export type EmergencyKillSwitch =
  | 'disable_payments'
  | 'disable_creator_publishing'
  | 'disable_rewards'
  | 'disable_event_participation';

export interface EmergencyControlAction {
  killSwitch: EmergencyKillSwitch;
  enabled: boolean;
  reason: string;
}

// ============================================================
// User Search & Operations
// ============================================================

export interface AdminUserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  level: number;
  xpTotal: number;
  status: string;
  totalGamesPlayed: number;
  challenges: number;
  events: number;
  teams: number;
  isCreator: boolean;
  rewards: {
    totalXpEarned: number;
    totalItemsAcquired: number;
    totalPurchases: number;
  };
  fraudFlags: number;
  createdAt: Date;
  lastActiveAt: Date | null;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  level: number;
  status: string;
  lastActiveAt: Date | null;
  createdAt: Date;
}

// ============================================================
// Analytics
// ============================================================

export interface AnalyticsOverview {
  acquisition: {
    newUsers: number;
    signupSource: Record<string, number>;
    topCountries: Array<{ country: string; count: number }>;
  };
  activation: {
    firstGameRate: number;
    onboardingCompletionRate: number;
  };
  engagement: {
    sessionsPerUser: number;
    gamesPerUser: number;
    challengesPerUser: number;
    eventsPerUser: number;
    friendsPerUser: number;
    teamsPerUser: number;
  };
  retention: {
    d1: number;
    d7: number;
    d30: number;
  };
  monetization: {
    storeConversion: number;
    starsConversion: number;
    arppu: number;
    arpu: number;
    revenuePerUser: number;
    rewardedAdUsage: number;
  };
}

export interface FunnelStep {
  name: string;
  count: number;
  conversionRate: number;
}

export interface CohortData {
  cohortDate: string;
  cohortSize: number;
  retention: Record<string, number>;
}

// ============================================================
// Data Export
// ============================================================

export interface DataExportRequest {
  exportType: string;
  filters: Record<string, unknown>;
}

export interface DataExportLog {
  id: string;
  adminUserId: string;
  exportType: string;
  filters: Record<string, unknown>;
  recordCount: number | null;
  fileUrl: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}

// ============================================================
// Admin Notifications
// ============================================================

export interface AdminNotification {
  id: string;
  adminUserId: string;
  title: string;
  message: string;
  type: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: Date;
}

// ============================================================
// Pagination
// ============================================================

export interface AdminPaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface AdminPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
