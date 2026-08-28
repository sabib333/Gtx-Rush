/**
 * GTX Rush — Content Validation Service v1.0
 *
 * Server-authoritative content validation that handles:
 * - Schema validation
 * - Content sanitization
 * - Safety validation
 * - Game rule validation
 * - Moderation
 *
 * SECURITY:
 * - All content is validated server-side
 * - No arbitrary code execution
 * - Malicious content is rejected
 *
 * Contract: Creator Engine Contract v1.0
 */

import type {
  CreatorReportReason,
  ModerationStatus,
  ModerationAction,
  ContentQuality,
  ContentReport,
  ModerationRecord,
} from '@gtx-rush/types';
import {
  CONTENT_VALIDATION_CONFIG,
  MODERATION_CONFIG,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const contentReports = new Map<string, ContentReport[]>(); // contentId → reports
const moderationRecords = new Map<string, ModerationRecord[]>(); // creatorId → records
const flaggedContent = new Map<string, { reason: string; flaggedAt: Date }>(); // contentId → flag info

// ============================================================
// Content Validation
// ============================================================

/**
 * Validate content for publication
 */
export function validateContent(
  content: {
    title: string;
    description?: string;
    type: 'challenge' | 'creator' | 'comment';
  },
  creatorId: string,
): { valid: boolean; status: ModerationStatus; errors: string[] } {
  const errors: string[] = [];

  // Schema validation
  if (!content.title || content.title.trim().length === 0) {
    errors.push('Title is required');
  }

  // Content safety validation
  if (containsMaliciousContent(content.title)) {
    errors.push('Title contains potentially malicious content');
  }

  if (content.description && containsMaliciousContent(content.description)) {
    errors.push('Description contains potentially malicious content');
  }

  // Profanity check
  if (CONTENT_VALIDATION_CONFIG.profanityFilter.enabled) {
    if (containsProfanity(content.title)) {
      if (CONTENT_VALIDATION_CONFIG.profanityFilter.action === 'reject') {
        errors.push('Title contains inappropriate content');
      }
    }
    if (content.description && containsProfanity(content.description)) {
      if (CONTENT_VALIDATION_CONFIG.profanityFilter.action === 'reject') {
        errors.push('Description contains inappropriate content');
      }
    }
  }

  // Spam detection
  if (CONTENT_VALIDATION_CONFIG.spamDetection.enabled) {
    if (isSpam(content.title, creatorId)) {
      errors.push('Content appears to be spam');
    }
  }

  // Determine moderation status
  let status: ModerationStatus = 'approved';
  if (errors.length > 0) {
    status = 'rejected';
  } else if (needsReview(content, creatorId)) {
    status = 'under_review';
  }

  return {
    valid: errors.length === 0,
    status,
    errors,
  };
}

/**
 * Sanitize text content
 */
export function sanitizeText(text: string): string {
  // Remove HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');

  // Remove JavaScript
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove event handlers
  sanitized = sanitized.replace(/on\w+=/gi, '');

  // Remove data URIs
  sanitized = sanitized.replace(/data:/gi, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Check if content contains malicious patterns
 */
function containsMaliciousContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  const maliciousPatterns = [
    '<script',
    'javascript:',
    'onclick',
    'onerror',
    'onload',
    'onmouseover',
    'data:',
    'vbscript:',
    'expression(',
    'url(',
    'eval(',
    'document.cookie',
    'document.write',
    'window.location',
  ];

  return maliciousPatterns.some((pattern) => lowerText.includes(pattern));
}

/**
 * Check for profanity (simplified)
 */
function containsProfanity(text: string): boolean {
  // In production, use a real profanity filter service
  // This is a simplified version
  const lowerText = text.toLowerCase();
  const basicProfanity = ['badword1', 'badword2', 'badword3'];
  return basicProfanity.some((word) => lowerText.includes(word));
}

/**
 * Check for spam patterns
 */
function isSpam(text: string, creatorId: string): boolean {
  // Check for excessive repetition
  const words = text.split(' ');
  const uniqueWords = new Set(words);
  if (words.length > 5 && uniqueWords.size < words.length * 0.3) {
    return true;
  }

  // Check for excessive capitalization
  const uppercaseCount = (text.match(/[A-Z]/g) ?? []).length;
  if (text.length > 10 && uppercaseCount / text.length > 0.7) {
    return true;
  }

  // Check for excessive punctuation
  const punctuationCount = (text.match(/[!?.,:;]/g) ?? []).length;
  if (text.length > 10 && punctuationCount / text.length > 0.3) {
    return true;
  }

  return false;
}

/**
 * Check if content needs manual review
 */
function needsReview(
  content: { title: string; description?: string; type: string },
  creatorId: string,
): boolean {
  // New creators need review
  const creatorRecords = moderationRecords.get(creatorId) ?? [];
  if (creatorRecords.length === 0) return true;

  // Check for previous moderation actions
  const hasRecentActions = creatorRecords.some(
    (r) => r.action === 'warning' || r.action === 'content_removed'
  );
  if (hasRecentActions) return true;

  return false;
}

// ============================================================
// Reporting System
// ============================================================

/**
 * Submit a content report
 */
export function submitReport(
  reporterId: string,
  contentType: 'challenge' | 'creator' | 'comment',
  contentId: string,
  reason: CreatorReportReason,
  description?: string,
): { success: boolean; report?: ContentReport; error?: string } {
  // Check if already reported by this user
  const existingReports = contentReports.get(contentId) ?? [];
  const alreadyReported = existingReports.some((r) => r.reporterId === reporterId);
  if (alreadyReported) {
    return { success: false, error: 'ALREADY_REPORTED' };
  }

  const report: ContentReport = {
    id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    reporterId,
    contentType,
    contentId,
    reason,
    description: description ?? null,
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    action: null,
    createdAt: new Date(),
  };

  existingReports.push(report);
  contentReports.set(contentId, existingReports);

  // Check if auto-action needed
  checkReportThresholds(contentId);

  return { success: true, report };
}

/**
 * Get reports for content
 */
export function getContentReports(contentId: string): ContentReport[] {
  return contentReports.get(contentId) ?? [];
}

/**
 * Get reports by a user
 */
export function getUserReports(userId: string): ContentReport[] {
  const allReports: ContentReport[] = [];
  for (const reports of contentReports.values()) {
    for (const report of reports) {
      if (report.reporterId === userId) {
        allReports.push(report);
      }
    }
  }
  return allReports;
}

/**
 * Check report thresholds and take action
 */
function checkReportThresholds(contentId: string): void {
  const reports = contentReports.get(contentId) ?? [];
  const pendingReports = reports.filter((r) => r.status === 'pending');

  if (pendingReports.length >= MODERATION_CONFIG.reportThresholds.autoReview) {
    // Auto-flag for review
    flaggedContent.set(contentId, {
      reason: 'Multiple reports received',
      flaggedAt: new Date(),
    });
  }

  if (pendingReports.length >= MODERATION_CONFIG.reportThresholds.autoRemove) {
    // Auto-remove content
    for (const report of pendingReports) {
      report.status = 'approved';
      report.action = 'content_removed';
      report.reviewedAt = new Date();
    }
  }
}

// ============================================================
// Moderation Actions
// ============================================================

/**
 * Record a moderation action
 */
export function recordModerationAction(
  creatorId: string,
  action: ModerationAction,
  reason: string,
  challengeId: string | null,
  performedBy: string,
): ModerationRecord {
  const record: ModerationRecord = {
    id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    creatorId,
    action,
    reason,
    challengeId,
    performedBy,
    expiresAt: null,
    createdAt: new Date(),
  };

  const records = moderationRecords.get(creatorId) ?? [];
  records.push(record);
  moderationRecords.set(creatorId, records);

  return record;
}

/**
 * Get moderation records for a creator
 */
export function getCreatorModerationRecords(creatorId: string): ModerationRecord[] {
  return moderationRecords.get(creatorId) ?? [];
}

/**
 * Check if creator is currently limited
 */
export function isCreatorLimited(creatorId: string): boolean {
  const records = moderationRecords.get(creatorId) ?? [];
  return records.some(
    (r) =>
      (r.action === 'limited_creation' || r.action === 'creator_suspended') &&
      (!r.expiresAt || r.expiresAt > new Date())
  );
}

/**
 * Calculate content quality score
 */
export function calculateContentQuality(stats: {
  completionRate: number;
  uniquePlayers: number;
  reactions: number;
  reports: number;
}): ContentQuality {
  const thresholds = CONTENT_VALIDATION_CONFIG.qualityThresholds;

  if (
    stats.completionRate >= thresholds.high.minCompletionRate &&
    stats.uniquePlayers >= thresholds.high.minUniquePlayers &&
    stats.reactions >= thresholds.high.minReactions &&
    stats.reports <= thresholds.high.maxReports
  ) {
    return 'high';
  }

  if (
    stats.completionRate <= thresholds.low.maxCompletionRate &&
    stats.uniquePlayers <= thresholds.low.maxUniquePlayers &&
    stats.reports >= thresholds.low.minReports
  ) {
    return 'low';
  }

  return 'normal';
}

/**
 * Clear all data (for testing)
 */
export function _clearAllValidationData(): void {
  contentReports.clear();
  moderationRecords.clear();
  flaggedContent.clear();
}
