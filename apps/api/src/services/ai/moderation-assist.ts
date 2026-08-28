/**
 * GTX Rush — AI Moderation Assistance v1.0
 *
 * Pipeline (§17):
 *   Content Submitted → Rule Validation → AI Screening → Risk Score
 *     → Automatic decision OR Human Review
 *
 * AI assists; it does NOT auto-publish unsafe content (§18).
 * User-generated content is sanitized and length-limited before any
 * AI processing (§57) and can never alter system behavior (§56).
 *
 * Contract: AI Intelligence Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  ContentScreeningResult,
  DuplicateMatch,
} from '@gtx-rush/types';
import {
  MODERATION_AI_CONFIG,
} from '@gtx-rush/config';
import { computeTextFingerprint, textSimilarity } from './feature-store';

// ============================================================
// In-memory stores
// ============================================================

interface ContentFingerprintRecord {
  contentId: string;
  creatorId: string;
  fingerprint: string;
  rawLength: number;
}

const fingerprintIndex = new Map<string, ContentFingerprintRecord>(); // contentId → record
const flaggedContent = new Map<string, ContentScreeningResult>();
const screenCallTimestamps: number[] = []; // global cost budget

// ============================================================
// Input Sanitization (§57)
// ============================================================

export interface SanitizedInput {
  ok: boolean;
  text: string;
  truncated: boolean;
  injectionDetected: boolean;
}

/**
 * Sanitize user-generated content before ANY AI processing:
 * length-limited, pattern-screened for prompt injection.
 */
export function sanitizeForAI(contentId: string, text: string): SanitizedInput {
  void contentId;

  const injectionDetected = MODERATION_AI_CONFIG.injectionPatterns.some((pattern) =>
    pattern.test(text),
  );

  const maxLength = MODERATION_AI_CONFIG.maxScreenableLength;
  const truncated = text.length > maxLength;
  const safeText = truncated ? text.slice(0, maxLength) : text;

  return {
    ok: !injectionDetected,
    text: safeText,
    truncated,
    injectionDetected,
  };
}

// ============================================================
// Cost Control (§41)
// ============================================================

/**
 * Global screening budget. When exhausted, callers MUST fall back to
 * rule-engine-only decisions. Never send every event to an LLM.
 */
export function tryConsumeScreeningBudget(): boolean {
  const oneMinuteAgo = Date.now() - 60 * 1000;
  while (
    screenCallTimestamps.length > 0 &&
    (screenCallTimestamps[0] ?? Infinity) < oneMinuteAgo
  ) {
    screenCallTimestamps.shift();
  }

  if (screenCallTimestamps.length >= 30 /* maxScreeningCallsPerMinute */) {
    return false;
  }
  screenCallTimestamps.push(Date.now());
  return true;
}

// ============================================================
// Screening Pipeline (§17)
// ============================================================

const BLOCKED_PATTERNS = [
  /\b(fuck|shit|bitch|asshole)\b/i,
  /\b(kill yourself|kys)\b/i,
  /\b(hate speech|n[i1]gg)/i,
];

const RISKY_PATTERNS: Array<{ pattern: RegExp; flag: string; weight: number }> = [
  { pattern: /\b(free\s+(gems|coins|xp)|cheat|hack|exploit)\b/i, flag: 'cheat_reference', weight: 30 },
  { pattern: /\b(buy now or lose|limited time only!!+)\b/i, flag: 'deceptive_urgency', weight: 25 },
  { pattern: /https?:\/\/(?!t\.me\/gtxrushbot)[^\s]+/i, flag: 'external_link', weight: 15 },
  { pattern: /(.)\1{15,}/i, flag: 'spam_pattern', weight: 20 },
];

/**
 * Screen creator/user content. Returns a decision; high-risk content is
 * routed to HUMAN REVIEW, never silently published or destroyed.
 */
export function screenContent(
  contentId: string,
  creatorId: string,
  title: string,
  description: string,
): ContentScreeningResult {
  const combined = `${title}\n${description}`;

  // Stage 1: sanitize + prompt-injection screening (§56, §57)
  const sanitized = sanitizeForAI(contentId, combined);

  // Stage 2: rule validation
  const flags: string[] = [];
  let riskScore = 0;

  if (sanitized.injectionDetected) {
    flags.push('prompt_injection_attempt');
    riskScore += 60;
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(combined)) {
      flags.push('prohibited_language');
      riskScore += 50;
      break;
    }
  }

  for (const risky of RISKY_PATTERNS) {
    if (risky.pattern.test(combined)) {
      flags.push(risky.flag);
      riskScore += risky.weight;
    }
  }

  // Stage 3: duplicate check (§20)
  const duplicateMatch = findDuplicate(contentId, creatorId, combined);
  if (duplicateMatch && duplicateMatch.similarity >= MODERATION_AI_CONFIG.duplicateSimilarityThreshold) {
    flags.push('near_duplicate_content');
    riskScore += 35;
  }

  // Register fingerprint for future comparisons
  registerFingerprint(contentId, creatorId, combined);

  const ruleValidationPassed = !flags.includes('prompt_injection_attempt');

  // Decision boundaries
  let decision: ContentScreeningResult['decision'];
  if (riskScore >= 85) decision = 'block';
  else if (riskScore >= 45) decision = 'human_review';
  else if (flags.length > 0 || duplicateMatch !== null) decision = 'allow_with_flags';
  else decision = 'allow';

  const result: ContentScreeningResult = {
    contentId,
    ruleValidationPassed,
    riskScore: Math.min(100, riskScore),
    riskLevel: riskScoreToLevel(Math.min(100, riskScore)),
    decision,
    flags,
    reasonCodes: flags,
    sanitizedForAI: true,
  };

  if (decision === 'human_review' || decision === 'block') {
    flaggedContent.set(contentId, result);
  }

  return result;
}

function riskScoreToLevel(score: number): ContentScreeningResult['riskLevel'] {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ============================================================
// Duplicate Detection (§20)
// ============================================================

function registerFingerprint(contentId: string, creatorId: string, text: string): void {
  fingerprintIndex.set(contentId, {
    contentId,
    creatorId,
    fingerprint: computeTextFingerprint(text),
    rawLength: text.length,
  });
}

/**
 * Find the most similar existing content. Safeguard: similarity alone never
 * triggers punishment — it contributes to the review pipeline.
 */
export function findDuplicate(
  contentId: string,
  creatorId: string,
  text: string,
): DuplicateMatch | null {
  const tokens = new Set(computeTextFingerprint(text).split(' ').filter(Boolean));
  if (tokens.size === 0) return null;

  let best: DuplicateMatch | null = null;

  for (const record of fingerprintIndex.values()) {
    if (record.contentId === contentId) continue;

    const existing = new Set(record.fingerprint.split(' ').filter(Boolean));
    if (existing.size === 0) continue;

    let intersection = 0;
    for (const token of tokens) {
      if (existing.has(token)) intersection++;
    }
    const similarity = intersection / (tokens.size + existing.size - intersection);

    if (!best || similarity > best.similarity) {
      best = { contentId: record.contentId, similarity };
    }
  }

  void creatorId;
  return best;
}

// ============================================================
// Creator AI Assistance (§18)
// ============================================================

const TITLE_SUGGESTION_TEMPLATES = [
  '⚡ {game} Speed Trial',
  '🔥 {game}: Can You Keep Up?',
  '🏆 {difficulty} {game} Challenge',
];

/**
 * Suggest titles for creators. Suggestions ONLY — nothing is ever
 * auto-published without explicit creator action.
 */
export function suggestTitle(gameName: string, difficulty: string): string[] {
  return TITLE_SUGGESTION_TEMPLATES.map((template) =>
    template.replace('{game}', gameName).replace('{difficulty}', difficulty),
  );
}

// ============================================================
// Queries
// ============================================================

export function getFlaggedContent(): Array<ContentScreeningResult & { id: string }> {
  return Array.from(flaggedContent.entries()).map(([id, result]) => ({
    id,
    ...result,
  }));
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearModerationAssist(): void {
  fingerprintIndex.clear();
  flaggedContent.clear();
  screenCallTimestamps.length = 0;
}
