/**
 * GTX Rush — Admin Command Center Database Schema v1.0
 *
 * Drizzle ORM schema definitions for admin-specific tables.
 * Extends the base schema with admin users, audit logs,
 * moderation cases, fraud cases, feature flags, experiments,
 * configuration versions, and alerts.
 *
 * Contract: Admin Command Center Contract v1.0
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './schema';

// ============================================================
// Enums
// ============================================================

export const adminRoleEnumV2 = pgEnum('admin_role_v2', [
  'super_admin',
  'ops_admin',
  'game_admin',
  'content_admin',
  'moderator',
  'analyst',
  'finance_viewer',
  'support_agent',
]);

export const adminActionEnum = pgEnum('admin_action', [
  'PRICE_CHANGED',
  'EVENT_UPDATED',
  'CONTENT_REMOVED',
  'USER_SUSPENDED',
  'USER_RESTRICTED',
  'USER_RESTORED',
  'REWARD_REVERSED',
  'GAME_ENABLED',
  'GAME_DISABLED',
  'GAME_MAINTENANCE',
  'CONFIG_CHANGED',
  'FEATURE_FLAG_TOGGLED',
  'EMERGENCY_KILL_SWITCH',
  'LEADERBOARD_FROZEN',
  'LEADERBOARD_CORRECTION',
  'MODERATION_ACTION',
  'FRAUD_ACTION',
  'REWARD_ADJUSTMENT',
  'PAYMENT_INSPECTED',
  'DATA_EXPORTED',
  'EXPERIMENT_CREATED',
  'EXPERIMENT_UPDATED',
  'EXPERIMENT_PAUSED',
  'EXPERIMENT_COMPLETED',
  'ALERT_CREATED',
  'ALERT_ACKNOWLEDGED',
  'SESSION_REVOKED',
  'ROLE_ASSIGNED',
  'ROLE_REVOKED',
  'ADMIN_LOGIN',
  'ADMIN_LOGOUT',
]);

export const moderationStatusEnum = pgEnum('moderation_status', [
  'new',
  'reviewing',
  'action_taken',
  'resolved',
  'dismissed',
]);

export const moderationActionEnum = pgEnum('moderation_action_type', [
  'no_action',
  'warning',
  'content_removed',
  'user_restricted',
  'user_suspended',
]);

export const moderationTargetTypeEnum = pgEnum('moderation_target_type', [
  'report',
  'creator_content',
  'profile',
  'team_content',
  'challenge',
]);

export const featureFlagStatusEnum = pgEnum('feature_flag_status', [
  'active',
  'inactive',
  'draft',
]);

export const experimentStatusEnum = pgEnum('experiment_status', [
  'draft',
  'running',
  'paused',
  'completed',
]);

export const configDeployStatusEnum = pgEnum('config_deploy_status', [
  'draft',
  'scheduled',
  'active',
  'rolled_back',
]);

export const alertSeverityEnum = pgEnum('alert_severity', [
  'info',
  'warning',
  'critical',
  'emergency',
]);

export const alertStatusEnum = pgEnum('alert_status', [
  'active',
  'acknowledged',
  'resolved',
]);

export const systemStatusEnum = pgEnum('system_status', [
  'healthy',
  'degraded',
  'down',
]);

export const gameOperationalStatusEnum = pgEnum('game_operational_status', [
  'enabled',
  'disabled',
  'maintenance',
]);

// ============================================================
// Admin Users (extended from base schema)
// ============================================================

export const adminUsersV2 = pgTable('admin_users_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 128 }).notNull(),
  role: adminRoleEnumV2('role').notNull().default('support_agent'),
  permissions: jsonb('permissions').$type<string[]>().default([]),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: varchar('last_login_ip', { length: 45 }),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_admin_users_v2_email').on(table.email),
  index('idx_admin_users_v2_role').on(table.role),
  index('idx_admin_users_v2_active').on(table.isActive),
]);

// ============================================================
// Admin Sessions
// ============================================================

export const adminSessions = pgTable('admin_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUserId: uuid('admin_user_id').notNull().references(() => adminUsersV2.id),
  tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  isActive: boolean('is_active').notNull().default(true),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_admin_sessions_admin').on(table.adminUserId),
  index('idx_admin_sessions_token').on(table.tokenHash),
  index('idx_admin_sessions_active').on(table.isActive, table.expiresAt),
]);

// ============================================================
// Admin Audit Log (immutable)
// ============================================================

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUserId: uuid('admin_user_id').notNull().references(() => adminUsersV2.id),
  action: adminActionEnum('action').notNull(),
  targetType: varchar('target_type', { length: 64 }),
  targetId: varchar('target_id', { length: 128 }),
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),
  reason: text('reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  requestId: varchar('request_id', { length: 128 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_admin_audit_logs_admin').on(table.adminUserId),
  index('idx_admin_audit_logs_action').on(table.action),
  index('idx_admin_audit_logs_target').on(table.targetType, table.targetId),
  index('idx_admin_audit_logs_created').on(table.createdAt),
]);

// ============================================================
// Moderation Cases
// ============================================================

export const moderationCases = pgTable('moderation_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseNumber: integer('case_number').notNull().unique(),
  targetType: moderationTargetTypeEnum('target_type').notNull(),
  targetId: varchar('target_id', { length: 128 }).notNull(),
  reportedUserId: uuid('reported_user_id').references(() => users.id),
  reporterUserId: uuid('reporter_user_id').references(() => users.id),
  reason: text('reason').notNull(),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().default({}),
  status: moderationStatusEnum('status').notNull().default('new'),
  priority: integer('priority').notNull().default(0),
  assignedTo: uuid('assigned_to').references(() => adminUsersV2.id),
  resolutionAction: moderationActionEnum('resolution_action'),
  resolutionReason: text('resolution_reason'),
  resolvedBy: uuid('resolved_by').references(() => adminUsersV2.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_moderation_cases_status').on(table.status),
  index('idx_moderation_cases_type').on(table.targetType),
  index('idx_moderation_cases_priority').on(table.priority, table.status),
  index('idx_moderation_cases_assigned').on(table.assignedTo),
]);

// ============================================================
// Fraud Cases
// ============================================================

export const fraudCases = pgTable('fraud_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseNumber: integer('case_number').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id),
  flagType: varchar('flag_type', { length: 64 }).notNull(),
  severity: varchar('severity', { length: 16 }).notNull().default('low'),
  description: text('description'),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().default({}),
  status: varchar('status', { length: 32 }).notNull().default('detected'),
  action: varchar('action', { length: 32 }),
  actionReason: text('action_reason'),
  reviewedBy: uuid('reviewed_by').references(() => adminUsersV2.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => [
  index('idx_fraud_cases_user').on(table.userId),
  index('idx_fraud_cases_status').on(table.status),
  index('idx_fraud_cases_severity').on(table.severity, table.status),
]);

// ============================================================
// Feature Flags
// ============================================================

export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 64 }).notNull().unique(),
  displayName: varchar('display_name', { length: 128 }).notNull(),
  description: text('description').default(''),
  status: featureFlagStatusEnum('status').notNull().default('draft'),
  defaultValue: boolean('default_value').notNull().default(false),
  rolloutPercentage: integer('rollout_percentage').notNull().default(0),
  rolloutStrategy: varchar('rollout_strategy', { length: 32 }).default('percentage'),
  targetAudience: jsonb('target_audience').$type<{
    countries?: string[];
    minLevel?: number;
    maxLevel?: number;
    userTags?: string[];
  }>().default({}),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdBy: uuid('created_by').references(() => adminUsersV2.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_feature_flags_name').on(table.name),
  index('idx_feature_flags_status').on(table.status),
]);

// ============================================================
// Feature Flag Audit
// ============================================================

export const featureFlagAudits = pgTable('feature_flag_audits', {
  id: uuid('id').primaryKey().defaultRandom(),
  flagId: uuid('flag_id').notNull().references(() => featureFlags.id),
  adminUserId: uuid('admin_user_id').notNull().references(() => adminUsersV2.id),
  action: varchar('action', { length: 32 }).notNull(),
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_feature_flag_audits_flag').on(table.flagId),
  index('idx_feature_flag_audits_created').on(table.createdAt),
]);

// ============================================================
// Experiments (A/B Tests)
// ============================================================

export const experiments = pgTable('experiments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull().unique(),
  description: text('description').default(''),
  status: experimentStatusEnum('status').notNull().default('draft'),
  variants: jsonb('variants').$type<Array<{
    id: string;
    name: string;
    weight: number;
    config: Record<string, unknown>;
  }>>().default([]),
  audience: jsonb('audience').$type<{
    percentage: number;
    countries?: string[];
    minLevel?: number;
    maxLevel?: number;
  }>().default({ percentage: 100 }),
  targetMetric: varchar('target_metric', { length: 64 }),
  hypothesis: text('hypothesis'),
  results: jsonb('results').$type<{
    control?: Record<string, number>;
    variants?: Record<string, Record<string, number>>;
    winner?: string;
    confidence?: number;
  }>(),
  createdBy: uuid('created_by').references(() => adminUsersV2.id),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_experiments_status').on(table.status),
  index('idx_experiments_name').on(table.name),
]);

// ============================================================
// Experiment Assignments
// ============================================================

export const experimentAssignments = pgTable('experiment_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  experimentId: uuid('experiment_id').notNull().references(() => experiments.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  variantId: varchar('variant_id', { length: 64 }).notNull(),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_experiment_assignments_exp_user').on(table.experimentId, table.userId),
  index('idx_experiment_assignments_variant').on(table.experimentId, table.variantId),
]);

// ============================================================
// Configuration Versions
// ============================================================

export const configVersions = pgTable('config_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  version: integer('version').notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull(),
  status: configDeployStatusEnum('status').notNull().default('draft'),
  authorId: uuid('author_id').notNull().references(() => adminUsersV2.id),
  reason: text('reason'),
  scheduledAt: timestamp('scheduled_at'),
  deployedAt: timestamp('deployed_at'),
  rolledBackAt: timestamp('rolled_back_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_config_versions_entity').on(table.entityType, table.entityId),
  index('idx_config_versions_status').on(table.status),
  uniqueIndex('idx_config_versions_entity_version').on(table.entityType, table.entityId, table.version),
]);

// ============================================================
// Admin Alerts
// ============================================================

export const adminAlerts = pgTable('admin_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 128 }).notNull(),
  message: text('message').notNull(),
  severity: alertSeverityEnum('severity').notNull().default('info'),
  category: varchar('category', { length: 64 }).notNull(),
  status: alertStatusEnum('status').notNull().default('active'),
  source: varchar('source', { length: 64 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  acknowledgedBy: uuid('acknowledged_by').references(() => adminUsersV2.id),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_admin_alerts_status').on(table.status),
  index('idx_admin_alerts_severity').on(table.severity),
  index('idx_admin_alerts_category').on(table.category),
  index('idx_admin_alerts_created').on(table.createdAt),
]);

// ============================================================
// Admin Notifications
// ============================================================

export const adminNotifications = pgTable('admin_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUserId: uuid('admin_user_id').notNull().references(() => adminUsersV2.id),
  title: varchar('title', { length: 128 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 64 }).notNull(),
  referenceType: varchar('reference_type', { length: 64 }),
  referenceId: varchar('reference_id', { length: 128 }),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_admin_notifications_admin').on(table.adminUserId, table.isRead),
  index('idx_admin_notifications_type').on(table.type),
]);

// ============================================================
// Data Export Log
// ============================================================

export const dataExports = pgTable('data_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUserId: uuid('admin_user_id').notNull().references(() => adminUsersV2.id),
  exportType: varchar('export_type', { length: 64 }).notNull(),
  filters: jsonb('filters').$type<Record<string, unknown>>().default({}),
  recordCount: integer('record_count'),
  fileUrl: text('file_url'),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('idx_data_exports_admin').on(table.adminUserId),
  index('idx_data_exports_type').on(table.exportType),
]);
