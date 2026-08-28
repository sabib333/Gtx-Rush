/**
 * Reaction Rush — Game Session Hook
 *
 * Manages the full game session lifecycle:
 * 1. Create session (API)
 * 2. Play game (local)
 * 3. Submit result (API)
 * 4. Get score, rank, XP
 */

import { useState, useCallback } from 'react';
import type { GameResult, GameMode } from './types';
import type { InputEvent } from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface GameSessionState {
  status: 'idle' | 'creating' | 'ready' | 'playing' | 'submitting' | 'completed' | 'error';
  sessionId: string | null;
  result: GameSessionResult | null;
  error: string | null;
}

export interface GameSessionResult {
  score: number;
  personalBest: number;
  isPersonalBest: boolean;
  globalRank: number;
  xpAwarded: number;
  breakdown: Record<string, number>;
  metadata: Record<string, unknown>;
  verdict: string;
}

export function useGameSession() {
  const [state, setState] = useState<GameSessionState>({
    status: 'idle',
    sessionId: null,
    result: null,
    error: null,
  });

  // Create a new session
  const createSession = useCallback(async (mode: GameMode = 'normal', challengeId?: string) => {
    setState({ status: 'creating', sessionId: null, result: null, error: null });

    try {
      const response = await fetch(`${API_BASE}/api/games/reaction-rush/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gtxr_auth_token') ?? 'mock-token'}`,
        },
        body: JSON.stringify({
          clientSessionToken: crypto.randomUUID(),
          mode,
          challengeId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message ?? 'Failed to create session');
      }

      setState({
        status: 'ready',
        sessionId: data.data.sessionId,
        result: null,
        error: null,
      });

      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setState({ status: 'error', sessionId: null, result: null, error: message });
      return null;
    }
  }, []);

  // Submit game result
  const submitResult = useCallback(async (
    events: InputEvent[],
    durationMs: number
  ): Promise<GameSessionResult | null> => {
    if (!state.sessionId) {
      setState((prev) => ({ ...prev, error: 'No active session', status: 'error' }));
      return null;
    }

    setState((prev) => ({ ...prev, status: 'submitting' }));

    try {
      const response = await fetch(
        `${API_BASE}/api/games/reaction-rush/session/${state.sessionId}/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('gtxr_auth_token') ?? 'mock-token'}`,
          },
          body: JSON.stringify({
            events: events.map((e) => ({
              type: e.type,
              timestamp: e.timestamp,
              roundNumber: e.roundNumber,
              data: e.data,
            })),
            durationMs,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message ?? 'Failed to submit score');
      }

      const result: GameSessionResult = {
        score: data.data.score,
        personalBest: data.data.personalBest,
        isPersonalBest: data.data.isPersonalBest,
        globalRank: data.data.globalRank,
        xpAwarded: data.data.xpAwarded,
        breakdown: data.data.breakdown,
        metadata: data.data.metadata,
        verdict: data.data.verdict,
      };

      setState((prev) => ({
        ...prev,
        status: 'completed',
        result,
      }));

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit score';
      setState((prev) => ({ ...prev, status: 'error', error: message }));
      return null;
    }
  }, [state.sessionId]);

  // Reset for a new game
  const reset = useCallback(() => {
    setState({ status: 'idle', sessionId: null, result: null, error: null });
  }, []);

  return {
    ...state,
    createSession,
    submitResult,
    reset,
    isIdle: state.status === 'idle',
    isCreating: state.status === 'creating',
    isReady: state.status === 'ready',
    isPlaying: state.status === 'playing',
    isSubmitting: state.status === 'submitting',
    isCompleted: state.status === 'completed',
    hasError: state.status === 'error',
  };
}
