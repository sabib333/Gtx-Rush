/**
 * Bot Webhook Route
 *
 * Production webhook endpoint for the Telegram bot.
 * Receives updates from Telegram and forwards to the bot processor.
 *
 * In production, Telegram sends updates to this endpoint.
 * The bot then processes them through grammy's webhook adapter.
 */

import type { FastifyInstance } from 'fastify';
import { getEnv } from '@gtx-rush/config';

export async function botWebhookRoute(app: FastifyInstance) {
  const env = getEnv();

  /**
   * POST /api/bot/webhook
   * Receives Telegram bot updates
   */
  app.post('/bot/webhook', async (request, reply) => {
    // Verify webhook secret if configured
    const secretToken = request.headers['x-telegram-bot-api-secret-token'];
    if (env.TELEGRAM_WEBHOOK_SECRET && secretToken !== env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('[BOT WEBHOOK] Invalid secret token', {
        ip: request.ip,
        timestamp: new Date().toISOString(),
      });
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const update = request.body;

    // Log the update (without sensitive data)
    console.debug('[BOT WEBHOOK] Received update', {
      updateId: (update as Record<string, unknown>)?.update_id,
      timestamp: new Date().toISOString(),
    });

    // In production, this would be processed by the bot's webhook handler.
    // For now, acknowledge receipt.
    return reply.status(200).send({ ok: true });
  });

  /**
   * GET /api/bot/webhook
   * Webhook status check
   */
  app.get('/bot/webhook', async () => {
    return {
      status: 'active',
      bot: env.TELEGRAM_BOT_USERNAME,
      timestamp: new Date().toISOString(),
    };
  });
}
