import { useState, useCallback } from 'react';

export type GamePhase = 'launch' | 'countdown' | 'playing' | 'paused' | 'result';

interface GameState {
  phase: GamePhase;
  score: number;
  timeLeft: number;
  round: number;
  totalRounds: number;
}

const initialState: GameState = {
  phase: 'launch',
  score: 0,
  timeLeft: 0,
  round: 0,
  totalRounds: 0,
};

/**
 * Game state hook for managing game lifecycle.
 * Separates game state from UI state.
 */
export function useGameState(totalRounds: number = 10) {
  const [state, setState] = useState<GameState>({
    ...initialState,
    totalRounds,
  });

  const startCountdown = useCallback(() => {
    setState((s) => ({ ...s, phase: 'countdown' }));
  }, []);

  const startGame = useCallback(() => {
    setState((s) => ({
      ...s,
      phase: 'playing',
      score: 0,
      timeLeft: 30,
      round: 1,
    }));
  }, []);

  const addScore = useCallback((points: number) => {
    setState((s) => ({ ...s, score: s.score + points }));
  }, []);

  const nextRound = useCallback(() => {
    setState((s) => ({
      ...s,
      round: s.round + 1,
    }));
  }, []);

  const endGame = useCallback(() => {
    setState((s) => ({ ...s, phase: 'result' }));
  }, []);

  const pauseGame = useCallback(() => {
    setState((s) => ({
      ...s,
      phase: s.phase === 'paused' ? 'playing' : 'paused',
    }));
  }, []);

  const resetGame = useCallback(() => {
    setState({ ...initialState, totalRounds });
  }, [totalRounds]);

  return {
    ...state,
    startCountdown,
    startGame,
    addScore,
    nextRound,
    endGame,
    pauseGame,
    resetGame,
  };
}
