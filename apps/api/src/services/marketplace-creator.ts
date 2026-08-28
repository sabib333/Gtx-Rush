/**
 * GTX Rush — Creator Marketplace Service v1.0
 *
 * CREATOR LOOP:
 *   CREATE → SUBMIT → MODERATION → PUBLISH →
 *   PLAYERS DISCOVER → PURCHASE → REVENUE LEDGER
 *
 * SECURITY:
 * - Rejected content never becomes purchasable (#28)
 * - Prices validated against published min/max rules
 * - Revenue calculated server-side from the completed transaction only (#26)
 * - Creators can NEVER manipulate platform currency balances (#62)
 * - All revenue records distinguish ESTIMATED vs FINALIZED (#49)
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  CreatorMarketSubmission,
  CreatorRevenueRecord,
  CreatorSubmissionStatus,
  MarketItem,
} from '@gtx-rush/types';
import { MARKETPLACE_CREATOR_REVENUE } from '@gtx-rush/config';
import {
  createMarketItem,
  updateMarketItemStatus,
} from './marketplace-catalog';
import { getCreatorRevenueSplit } from './marketplace-purchase';
import { recordAuditLog } from './marketplace-fraud';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const submissions = new Map<string, CreatorMarketSubmission>();
const revenueRecords = new Map<string, CreatorRevenueRecord>();

// ============================================================
// Submissions
// ============================================================

export function submitCreatorItem(
  creatorId: string,
  input: {
    name: string;
    description: string;
    itemType: CreatorMarketSubmission['itemType'];
    rarity: CreatorMarketSubmission['rarity'];
    imageUrl: string | null;
    proposedPriceStars: number;
  },
): { success: true; submission: CreatorMarketSubmission } | { success: false; error: string } {
  const { minPriceStars, maxPriceStars } = MARKETPLACE_CREATOR_REVENUE;

  if (!input.name || input.name.trim().length < 2) return { success: false, error: 'INVALID_NAME' };
  if (
    !Number.isInteger(input.proposedPriceStars) ||
    input.proposedPriceStars < minPriceStars ||
    input.proposedPriceStars > maxPriceStars
  ) {
    return { success: false, error: 'PRICE_OUT_OF_RANGE' };
  }

  // Technical validation of asset reference (#56)
  if (input.imageUrl !== null && !/^\/assets\/[a-zA-Z0-9\-_/.]+\.(png|webp|webm|svg)$/.test(input.imageUrl)) {
    return { success: false, error: 'INVALID_IMAGE_URL' };
  }

  const submission: CreatorMarketSubmission = {
    submissionId: `sub_${nanoid(16)}`,
    creatorId,
    name: input.name.trim(),
    description: input.description,
    itemType: input.itemType,
    rarity: input.rarity,
    imageUrl: input.imageUrl,
    proposedPriceStars: input.proposedPriceStars,
    status: 'PENDING_REVIEW',
    reviewerId: null,
    reviewNotes: null,
    publishedItemId: null,
    submittedAt: new Date(),
    reviewedAt: null,
  };
  submissions.set(submission.submissionId, submission);

  recordAuditLog(creatorId, 'creator_submission', 'creator_submission', submission.submissionId, {
    name: submission.name,
    proposedPriceStars: submission.proposedPriceStars,
  });

  return { success: true, submission };
}

export function getUserSubmissions(creatorId: string): CreatorMarketSubmission[] {
  return Array.from(submissions.values())
    .filter((s) => s.creatorId === creatorId)
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
}

export function getPendingSubmissions(): CreatorMarketSubmission[] {
  return Array.from(submissions.values())
    .filter((s) => s.status === 'PENDING_REVIEW')
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
}

// ============================================================
// Moderation (#25/#28)
// ============================================================

export function reviewCreatorSubmission(
  reviewerId: string,
  submissionId: string,
  decision: 'APPROVED' | 'REJECTED' | 'DISABLED',
  notes: string,
): { success: boolean; submission?: CreatorMarketSubmission; error?: string } {
  const submission = submissions.get(submissionId);
  if (!submission) return { success: false, error: 'SUBMISSION_NOT_FOUND' };
  if (submission.status !== 'PENDING_REVIEW') {
    return { success: false, error: 'SUBMISSION_NOT_PENDING' };
  }

  submission.status = decision as CreatorSubmissionStatus;
  submission.reviewerId = reviewerId;
  submission.reviewNotes = notes;
  submission.reviewedAt = new Date();

  recordAuditLog(reviewerId, `creator_submission_${decision.toLowerCase()}`, 'creator_submission', submissionId, { notes });
  return { success: true, submission };
}

/**
 * Publish an APPROVED submission as a live marketplace item.
 * Rejected content can NEVER reach this path.
 */
export function publishCreatorSubmission(
  reviewerId: string,
  submissionId: string,
): { success: true; item: MarketItem; submission: CreatorMarketSubmission } | { success: false; error: string } {
  const submission = submissions.get(submissionId);
  if (!submission) return { success: false, error: 'SUBMISSION_NOT_FOUND' };
  if (submission.status !== 'APPROVED') {
    return { success: false, error: 'NOT_APPROVED' };
  }

  const item = createMarketItem({
    itemId: `cc_${submission.submissionId}`,
    name: submission.name,
    description: submission.description,
    type: submission.itemType,
    rarity: submission.rarity,
    image: submission.imageUrl,
    animation: null,
    status: 'active',
    creatorId: submission.creatorId,
    collectionId: 'col_creator_series',
    eventId: null,
    seasonId: null,
    limited: false,
    availableFrom: null,
    availableUntil: null,
    tradable: false,
    stackable: false,
    acquisitionMethods: ['purchase'],
  });

  submission.status = 'PUBLISHED';
  submission.publishedItemId = item.itemId;

  recordAuditLog(reviewerId, 'creator_submission_published', 'item', item.itemId, {
    submissionId,
    creatorId: submission.creatorId,
  });

  return { success: true, item, submission };
}

export function disableCreatorItem(actorAdminId: string, itemId: string): boolean {
  const result = updateMarketItemStatus(itemId, 'disabled', 'disabled by admin');
  if (result.success) {
    recordAuditLog(actorAdminId, 'creator_item_disabled', 'item', itemId, {});
  }
  return result.success;
}

// ============================================================
// Revenue Ledger (#26/#27 — server-side only)
// ============================================================

/**
 * Record creator revenue for a completed purchase transaction.
 * Called ONLY from the purchase pipeline with the authoritative amount.
 */
export function recordCreatorRevenue(
  creatorId: string,
  itemId: string,
  transactionId: string,
  grossStars: number,
): CreatorRevenueRecord {
  const split = getCreatorRevenueSplit(grossStars);

  const record: CreatorRevenueRecord = {
    revenueId: `rev_${nanoid(16)}`,
    creatorId,
    itemId,
    transactionId,
    grossAmount: split.grossAmount,
    platformShareBps: split.platformShareBps,
    platformShare: split.platformShare,
    creatorShare: split.creatorShare,
    adjustments: 0,
    status: 'ESTIMATED',
    createdAt: new Date(),
  };
  revenueRecords.set(record.revenueId, record);
  return record;
}

/** Finalize estimated revenue rows once payment settlement is confirmed. */
export function finalizeCreatorRevenue(transactionId: string): number {
  let finalized = 0;
  for (const record of revenueRecords.values()) {
    if (record.transactionId === transactionId && record.status === 'ESTIMATED') {
      record.status = 'FINALIZED';
      finalized += 1;
    }
  }
  return finalized;
}

export function getCreatorRevenueSummary(creatorId: string): {
  grossStars: number;
  platformShareStars: number;
  creatorShareStars: number;
  sales: number;
  estimatedStars: number;
  finalizedStars: number;
} {
  const records = Array.from(revenueRecords.values()).filter((r) => r.creatorId === creatorId);
  return {
    grossStars: records.reduce((sum, r) => sum + r.grossAmount, 0),
    platformShareStars: records.reduce((sum, r) => sum + r.platformShare, 0),
    creatorShareStars: records.reduce((sum, r) => sum + r.creatorShare, 0),
    sales: records.length,
    estimatedStars: records.filter((r) => r.status === 'ESTIMATED').reduce((sum, r) => sum + r.creatorShare, 0),
    finalizedStars: records.filter((r) => r.status === 'FINALIZED').reduce((sum, r) => sum + r.creatorShare, 0),
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearMarketplaceCreator(): void {
  submissions.clear();
  revenueRecords.clear();
}
