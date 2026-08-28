/**
 * GTX Rush — Admin Command Center Configuration v1.0
 *
 * Configuration for admin roles, permissions, alert thresholds,
 * emergency kill switches, and admin-specific settings.
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { AdminCommandCenterRole, AdminPermission } from '@gtx-rush/types';

// ============================================================
// Permission Matrix (imported from types for reference)
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
    'ai.view', 'ai.manage', 'ai.review',
    'features.view', 'features.toggle', 'features.configure',
    'emergency.view', 'emergency.activate_kill_switch',
    'alerts.view', 'alerts.create', 'alerts.acknowledge',
    'audit.view',
    'admin.manage_roles', 'admin.view_sessions', 'admin.revoke_sessions',
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
    'emergency.view', 'emergency.activate_kill_switch',
    'alerts.view', 'alerts.create', 'alerts.acknowledge',
    'audit.view',
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
    'ai.view', 'ai.review',
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
    'ai.view',
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
// Admin Session Configuration
// ============================================================

export const ADMIN_SESSION_CONFIG = {
  /** Session duration in milliseconds (8 hours) */
  sessionDurationMs: 8 * 60 * 60 * 1000,
  /** Maximum failed login attempts before lockout */
  maxFailedAttempts: 5,
  /** Lockout duration in milliseconds (30 minutes) */
  lockoutDurationMs: 30 * 60 * 1000,
  /** Rate limit: login attempts per minute */
  loginRateLimit: 5,
  /** Rate limit: admin API requests per minute */
  apiRateLimit: 200,
};

// ============================================================
// Alert Thresholds (Configurable)
// ============================================================

export interface AlertThreshold {
  name: string;
  category: string;
  condition: string;
  threshold: number;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  enabled: boolean;
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    name: 'fraud_spike',
    category: 'fraud',
    condition: 'fraud_flags_per_hour',
    threshold: 50,
    severity: 'critical',
    enabled: true,
  },
  {
    name: 'payment_failure_spike',
    category: 'payments',
    condition: 'payment_failures_per_hour',
    threshold: 20,
    severity: 'critical',
    enabled: true,
  },
  {
    name: 'reward_anomaly',
    category: 'economy',
    condition: 'xp_awarded_per_hour',
    threshold: 100000,
    severity: 'warning',
    enabled: true,
  },
  {
    name: 'server_error_spike',
    category: 'system',
    condition: 'error_rate_per_minute',
    threshold: 50,
    severity: 'critical',
    enabled: true,
  },
  {
    name: 'retention_drop',
    category: 'analytics',
    condition: 'd1_retention_percent',
    threshold: 20,
    severity: 'warning',
    enabled: true,
  },
  {
    name: 'revenue_anomaly',
    category: 'monetization',
    condition: 'daily_revenue_change_percent',
    threshold: 30,
    severity: 'warning',
    enabled: true,
  },
  {
    name: 'mass_reports',
    category: 'moderation',
    condition: 'reports_per_hour',
    threshold: 100,
    severity: 'critical',
    enabled: true,
  },
  {
    name: 'dau_spike',
    category: 'analytics',
    condition: 'dau_change_percent',
    threshold: 50,
    severity: 'info',
    enabled: true,
  },
];

// ============================================================
// Emergency Kill Switches
// ============================================================

export type EmergencyKillSwitch =
  | 'disable_payments'
  | 'disable_creator_publishing'
  | 'disable_rewards'
  | 'disable_event_participation';

export const EMERGENCY_KILL_SWITCHES: Record<EmergencyKillSwitch, {
  label: string;
  description: string;
  requiresConfirmation: boolean;
}> = {
  disable_payments: {
    label: 'Disable Payments',
    description: 'Prevents all Telegram Stars purchases and payment processing',
    requiresConfirmation: true,
  },
  disable_creator_publishing: {
    label: 'Disable Creator Publishing',
    description: 'Prevents creators from publishing new challenges',
    requiresConfirmation: true,
  },
  disable_rewards: {
    label: 'Disable Rewards',
    description: 'Prevents XP and reward distribution (gameplay still works)',
    requiresConfirmation: true,
  },
  disable_event_participation: {
    label: 'Disable Event Participation',
    description: 'Prevents users from joining or participating in events',
    requiresConfirmation: true,
  },
};

// ============================================================
// Feature Flag Defaults
// ============================================================

export const DEFAULT_ADMIN_FEATURE_FLAGS = [
  { name: 'new_home', displayName: 'New Home Screen', description: 'Redesigned home screen layout' },
  { name: 'creator_engine', displayName: 'Creator Engine', description: 'UGC challenge creation system' },
  { name: 'smart_recommendations', displayName: 'Smart Recommendations', description: 'AI-powered game recommendations' },
  { name: 'team_events', displayName: 'Team Events', description: 'Team-based competitive events' },
  { name: 'new_store', displayName: 'New Store', description: 'Redesigned cosmetic store' },
  { name: 'new_game', displayName: 'New Game Mode', description: 'Experimental new game mode' },
  { name: 'live_events', displayName: 'Live Events', description: 'Real-time live event system' },
  { name: 'social_feed', displayName: 'Social Feed', description: 'In-app social activity feed' },
  { name: 'achievement_system', displayName: 'Achievement System', description: 'Extended achievement tracking' },
  { name: 'advanced_analytics', displayName: 'Advanced Analytics', description: 'Enhanced analytics dashboard' },
];

// ============================================================
// Rollout Percentages
// ============================================================

export const ROLLOUT_PERCENTAGES = [1, 5, 10, 25, 50, 100] as const;

// ============================================================
// Admin API Namespace
// ============================================================

export const ADMIN_API_PREFIX = '/api/admin';

// ============================================================
// Sensitive Fields (never expose in admin UI)
// ============================================================

export const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'secret',
  'botToken',
  'apiKey',
  'paymentToken',
  'webhookSecret',
  'jwtSecret',
  'sessionSecret',
] as const;

// ============================================================
// Admin Role Display Names
// ============================================================

export const ROLE_DISPLAY_NAMES: Record<AdminCommandCenterRole, string> = {
  super_admin: 'Super Admin',
  ops_admin: 'Ops Admin',
  game_admin: 'Game Admin',
  content_admin: 'Content Admin',
  moderator: 'Moderator',
  analyst: 'Analyst',
  finance_viewer: 'Finance Viewer',
  support_agent: 'Support Agent',
};

// ============================================================
// Admin Role Colors (for UI)
// ============================================================

export const ROLE_COLORS: Record<AdminCommandCenterRole, string> = {
  super_admin: '#ef4444',
  ops_admin: '#f97316',
  game_admin: '#eab308',
  content_admin: '#22c55e',
  moderator: '#3b82f6',
  analyst: '#8b5cf6',
  finance_viewer: '#06b6d4',
  support_agent: '#6b7280',
};

// ============================================================
// Helper: Check Permission
// ============================================================

export function hasPermission(role: AdminCommandCenterRole, permission: AdminPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes(permission);
}

// ============================================================
// Helper: Get All Permissions for Role
// ============================================================

export function getRolePermissions(role: AdminCommandCenterRole): AdminPermission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

// ============================================================
// Helper: Validate Permission
// ============================================================

export function validatePermissions(permissions: string[]): AdminPermission[] {
  const validPermissions = new Set<string>([
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
    'ai.view', 'ai.manage', 'ai.review',
    'features.view', 'features.toggle', 'features.configure',
    'emergency.view', 'emergency.activate_kill_switch',
    'alerts.view', 'alerts.create', 'alerts.acknowledge',
    'audit.view',
    'admin.manage_roles', 'admin.view_sessions', 'admin.revoke_sessions',
  ]);

  return permissions.filter((p) => validPermissions.has(p)) as AdminPermission[];
}
