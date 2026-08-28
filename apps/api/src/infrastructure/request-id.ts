/**
 * GTX Rush — Request ID v1.0
 *
 * Generates and propagates unique request IDs through:
 * - API requests
 * - Database operations
 * - Background jobs
 * - Logs
 * - Admin audit records
 *
 * Enables distributed debugging and tracing.
 *
 * Contract: Production Infrastructure Contract v1.0
 */

import { randomBytes } from 'node:crypto';

/**
 * Generate a unique request ID.
 * Format: req_<timestamp_hex>_<random_hex>
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(6).toString('hex');
  return `req_${timestamp}_${random}`;
}

/**
 * Validate a request ID format.
 */
export function isValidRequestId(id: string): boolean {
  return /^req_[a-z0-9]+_[a-f0-9]+$/.test(id);
}

/**
 * Extract request ID from headers or generate one.
 * Accepts X-Request-ID header from upstream proxies.
 */
export function extractOrCreateRequestId(headers: Record<string, string | undefined>): string {
  const existing = headers['x-request-id'] ?? headers['x-request-id'.toLowerCase()];
  if (existing && isValidRequestId(existing)) {
    return existing;
  }
  return generateRequestId();
}
