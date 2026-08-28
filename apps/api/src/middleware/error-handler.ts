/**
 * GTX Rush — Global Error Handler v1.0
 *
 * Catches unhandled errors and returns consistent error format.
 * Never exposes stack traces to users in production.
 * Logs full error details server-side.
 *
 * Contract: Production Infrastructure Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { isProduction } from '@gtx-rush/config';
import { createLogger } from '../infrastructure/logger';

const log = createLogger('error-handler');

interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

/**
 * Register global error handler.
 */
export async function errorHandler(app: FastifyInstance): Promise<void> {
  // Set error serializer
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;

    // Log the full error
    log.error('Unhandled error', error, {
      requestId,
      method: request.method,
      url: request.url,
      statusCode: error.statusCode,
    });

    // Determine status code
    const statusCode = error.statusCode ?? 500;

    // Build error response
    const response: ApiError = {
      success: false,
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: statusCode === 500 && isProduction()
          ? 'An unexpected error occurred'
          : error.message,
        requestId,
      },
    };

    // Add details only in development
    if (!isProduction() && error.stack) {
      response.error.details = {
        stack: error.stack,
      };
    }

    reply.status(statusCode).send(response);
  });

  // Handle 404
  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    const response: ApiError = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
        requestId: _request.id,
      },
    };
    reply.status(404).send(response);
  });
}
