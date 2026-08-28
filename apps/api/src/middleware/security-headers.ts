/**
 * GTX Rush — Security Headers Middleware v1.0
 *
 * Adds security headers to all responses:
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Permissions-Policy
 * - X-Request-ID
 *
 * Contract: Production Infrastructure Contract v1.0
 */

import type { FastifyInstance } from 'fastify';
import { isProduction } from '@gtx-rush/config';

/**
 * Register security headers plugin.
 */
export async function securityHeaders(app: FastifyInstance): Promise<void> {
  app.addHook('onSend', async (_request, reply) => {
    // Strict Transport Security (HSTS) — production only
    if (isProduction()) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Prevent MIME type sniffing
    reply.header('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    reply.header('X-Frame-Options', 'DENY');

    // XSS protection (legacy but still useful for older browsers)
    reply.header('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy — restrict browser features
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

    // Don't expose server version
    reply.header('X-Powered-By', 'GTX Rush');

    // Cache control for API responses
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    reply.header('Pragma', 'no-cache');
  });
}
