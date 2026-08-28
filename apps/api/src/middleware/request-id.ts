/**
 * GTX Rush — Request ID Middleware v1.0
 *
 * Propagates request IDs through the entire request lifecycle.
 * Accepts X-Request-ID from upstream or generates a new one.
 *
 * Contract: Production Infrastructure Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { extractOrCreateRequestId } from '../infrastructure/request-id';

/**
 * Register request ID plugin.
 * Adds request.id to every request and X-Request-ID to every response.
 */
export async function requestIdPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    const headers = request.headers as Record<string, string | undefined>;
    const requestId = extractOrCreateRequestId(headers);
    request.id = requestId;
  });

  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('X-Request-ID', request.id);
  });
}
