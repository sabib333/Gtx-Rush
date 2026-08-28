/**
 * Quiz Rush — Game Session Hook
 *
 * Manages the quiz-specific session lifecycle:
 * 1. Create session (API) → get first question
 * 2. Submit answer (API) → get result + next question
 * 3. Complete session (API) → get final score
 */

import { useState, useCallback } from 'react';
import type { GameMode, PublicQuestion, AnsweredQuestion } from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface GameSessionState {
  status: 'idle' | 'creating' | 'ready' | 'playing' | 'submitting_answer' | 'completing' | 'completed' | 'error';
  sessionId: string | null;
  currentQuestion: PublicQuestion | null;
  questionsTotal: number;
  questionsAnswered: number;
  answeredQuestions: AnsweredQuestion[];
  lastAnswerResult: AnswerResult | null;
  finalResult: GameSessionResult | null;
  error: string | null;
}

export interface AnswerResult {
  correct: boolean;
  scoreEarned: number;
  streak: number;
  streakBonus: number;
  speedBonus: number;
  difficultyBonus: number;
  timeToAnswerMs: number;
  correctOptionId: string;
  explanation: string;
  questionsRemaining: number;
}

export interface GameSessionResult {
  score: number;
  personalBest: number;
  isPersonalBest: boolean;
  globalRank: number;
  xpAwarded: number;
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;
  highestStreak: number;
  fastestAnswerMs: number;
  breakdown: Record<string, number>;
  metadata: Record<string, unknown>;
  answers: AnsweredQuestion[];
  verdict: string;
}

export function useGameSession() {
  const [state, setState] = useState<GameSessionState>({
    status: 'idle',
    sessionId: null,
    currentQuestion: null,
    questionsTotal: 0,
    questionsAnswered: 0,
    answeredQuestions: [],
    lastAnswerResult: null,
    finalResult: null,
    error: null,
  });

  // Create a new session
  const createSession = useCallback(async (mode: GameMode = 'normal', challengeId?: string) => {
    setState((prev) => ({
      ...prev,
      status: 'creating',
      sessionId: null,
      currentQuestion: null,
      answeredQuestions: [],
      lastAnswerResult: null,
      finalResult: null,
      error: null,
    }));

    try {
      const response = await fetch(`${API_BASE}/api/games/quiz-rush/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gtxr_auth_token') ?? 'mock-token'}`,
        },
        body: JSON.stringify({
          clientSessionToken: crypto.randomUUID(),
          mode,
          challengeId,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed to create session');

      setState({
        status: 'ready',
        sessionId: data.data.sessionId,
        currentQuestion: data.data.firstQuestion,
        questionsTotal: data.data.totalQuestions,
        questionsAnswered: 0,
        answeredQuestions: [],
        lastAnswerResult: null,
        finalResult: null,
        error: null,
      });

      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setState((prev) => ({ ...prev, status: 'error', error: message }));
      return null;
    }
  }, []);

  // Submit an answer for the current question
  const submitAnswer = useCallback(
    async (
      questionId: string,
      selectedOptionId: string,
      timeToAnswerMs: number,
      sequenceNumber: number,
    ): Promise<AnswerResult | null> => {
      if (!state.sessionId) {
        setState((prev) => ({ ...prev, error: 'No active session', status: 'error' }));
        return null;
      }

      setState((prev) => ({ ...prev, status: 'submitting_answer' }));

      try {
        const response = await fetch(
          `${API_BASE}/api/games/quiz-rush/session/${state.sessionId}/answer`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('gtxr_auth_token') ?? 'mock-token'}`,
            },
            body: JSON.stringify({
              questionId,
              selectedOptionId,
              clientTimestamp: performance.now(),
              sequenceNumber,
            }),
          }
        );

        const data = await response.json();
        if (!data.success) throw new Error(data.error?.message ?? 'Failed to submit answer');

        const result: AnswerResult = {
          correct: data.data.correct,
          scoreEarned: data.data.scoreEarned,
          streak: data.data.streak,
          streakBonus: data.data.streakBonus,
          speedBonus: data.data.speedBonus,
          difficultyBonus: data.data.difficultyBonus,
          timeToAnswerMs: data.data.timeToAnswerMs,
          correctOptionId: data.data.correctOptionId,
          explanation: data.data.explanation,
          questionsRemaining: data.data.questionsRemaining,
        };

        setState((prev) => ({
          ...prev,
          status: 'playing',
          lastAnswerResult: result,
          currentQuestion: data.data.nextQuestion,
          questionsAnswered: prev.questionsAnswered + 1,
        }));

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit answer';
        setState((prev) => ({ ...prev, status: 'error', error: message }));
        return null;
      }
    },
    [state.sessionId]
  );

  // Complete the session and get final result
  const completeSession = useCallback(async (): Promise<GameSessionResult | null> => {
    if (!state.sessionId) {
      setState((prev) => ({ ...prev, error: 'No active session', status: 'error' }));
      return null;
    }

    setState((prev) => ({ ...prev, status: 'completing' }));

    try {
      const response = await fetch(
        `${API_BASE}/api/games/quiz-rush/session/${state.sessionId}/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('gtxr_auth_token') ?? 'mock-token'}`,
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message ?? 'Failed to complete session');

      const result: GameSessionResult = {
        score: data.data.score,
        personalBest: data.data.personalBest,
        isPersonalBest: data.data.isPersonalBest,
        globalRank: data.data.globalRank,
        xpAwarded: data.data.xpAwarded,
        correctAnswers: data.data.correctAnswers,
        totalQuestions: data.data.totalQuestions,
        accuracy: data.data.accuracy,
        highestStreak: data.data.highestStreak,
        fastestAnswerMs: data.data.fastestAnswerMs,
        breakdown: data.data.breakdown,
        metadata: data.data.metadata,
        answers: data.data.answers,
        verdict: data.data.verdict,
      };

      setState((prev) => ({
        ...prev,
        status: 'completed',
        finalResult: result,
        answeredQuestions: data.data.answers,
      }));

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete session';
      setState((prev) => ({ ...prev, status: 'error', error: message }));
      return null;
    }
  }, [state.sessionId]);

  // Reset for a new game
  const reset = useCallback(() => {
    setState({
      status: 'idle',
      sessionId: null,
      currentQuestion: null,
      questionsTotal: 0,
      questionsAnswered: 0,
      answeredQuestions: [],
      lastAnswerResult: null,
      finalResult: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    createSession,
    submitAnswer,
    completeSession,
    reset,
    isIdle: state.status === 'idle',
    isCreating: state.status === 'creating',
    isReady: state.status === 'ready',
    isPlaying: state.status === 'playing',
    isSubmittingAnswer: state.status === 'submitting_answer',
    isCompleting: state.status === 'completing',
    isCompleted: state.status === 'completed',
    hasError: state.status === 'error',
  };
}
