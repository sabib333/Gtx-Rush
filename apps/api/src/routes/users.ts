import type { FastifyInstance } from 'fastify';

export async function userRoutes(app: FastifyInstance) {
  /**
   * GET /api/users/me
   * Get current user profile
   */
  app.get('/me', async (request, reply) => {
    // TODO: Authenticate and fetch user
    return {
      success: true,
      data: {
        id: 'placeholder',
        displayName: 'Guest',
        username: 'guest',
        level: 1,
        xpTotal: 0,
        currentStreak: 0,
        longestStreak: 0,
        country: 'US',
      },
    };
  });

  /**
   * PATCH /api/users/me
   * Update current user profile
   */
  app.patch('/me', async (request, reply) => {
    // TODO: Validate input and update user
    const updates = request.body as Record<string, unknown>;
    return { success: true, data: { updated: true } };
  });

  /**
   * GET /api/users/:id
   * Get public user profile
   */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch public profile
    return {
      success: true,
      data: { id, displayName: 'User', level: 1 },
    };
  });
}
