import type { GameDefinition } from '@gtx-rush/types';

export const GAME_DEFINITIONS: Record<string, GameDefinition> = {
  'reaction-rush': {
    id: 'reaction-rush',
    name: 'Reaction Rush',
    version: 1,
    description: 'Test your reflexes! React as fast as you can.',
    minPlayers: 1,
    maxPlayers: 1,
    sessionConfig: {
      maxDurationMs: 60_000, // 60 seconds
      inputTimeoutMs: 10_000, // 10 seconds max wait for reaction
    },
  },
  'tap-rush': {
    id: 'tap-rush',
    name: 'Tap Rush',
    version: 1,
    description: 'Tap targets as fast and accurately as you can!',
    minPlayers: 1,
    maxPlayers: 1,
    sessionConfig: {
      maxDurationMs: 20_000, // 15s game + 5s buffer
      inputTimeoutMs: 5_000,
    },
  },
  'quiz-rush': {
    id: 'quiz-rush',
    name: 'Quiz Rush',
    version: 1,
    description: 'Think fast. Answer faster. Rise.',
    minPlayers: 1,
    maxPlayers: 1,
    sessionConfig: {
      maxDurationMs: 180_000, // 3 minutes (10 questions × 15s + buffer)
      inputTimeoutMs: 20_000, // 20 seconds per question
    },
  },
};

export const GAME_LIST = Object.values(GAME_DEFINITIONS);
