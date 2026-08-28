/**
 * Quiz Rush — Frontend Types
 */

export type GameMode = 'normal' | 'daily_challenge' | 'friend_challenge';

export type GameState =
  | 'idle'
  | 'countdown'
  | 'question_active'
  | 'answer_submitted'
  | 'next_question'
  | 'game_complete'
  | 'result'
  | 'review'
  | 'paused'
  | 'aborted'
  | 'error';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface PublicQuestion {
  id: string;
  version: number;
  category: string;
  difficulty: QuestionDifficulty;
  question: string;
  options: QuestionOption[];
  timeLimitMs: number;
  sequenceNumber: number;
}

export type InputEventType =
  | 'session_started'
  | 'question_shown'
  | 'answer_submitted'
  | 'timeout'
  | 'session_finished';

export interface InputEvent {
  type: InputEventType;
  timestamp: number;
  questionId?: string;
  questionSequence?: number;
  selectedOptionId?: string;
  timeToAnswerMs?: number;
  data?: Record<string, unknown>;
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

export interface GameSession {
  sessionId: string;
  gameVersion: string;
  mode: GameMode;
  challengeId?: string;
  opponentUserId?: string;
  targetScore?: number;
}

export interface AnsweredQuestion {
  questionId: string;
  question: string;
  category: string;
  difficulty: QuestionDifficulty;
  selectedOptionId: string | null;
  correctOptionId: string;
  options: QuestionOption[];
  correct: boolean;
  timeToAnswerMs: number;
  explanation: string;
}

export interface GameResult {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;
  highestStreak: number;
  fastestAnswerMs: number;
  breakdown: {
    baseScore: number;
    speedBonus: number;
    streakBonus: number;
    difficultyBonus: number;
  };
  metadata: Record<string, unknown>;
  events: InputEvent[];
  durationMs: number;
}

/** Config constants mirrored from game engine for frontend use */
export const QUIZ_RUSH_CONFIG = {
  questionCount: 10,
  defaultTimeLimitMs: 15_000,
  countdownDuration: 3,
  baseCorrectScore: 500,
  easyScoreMultiplier: 1.0,
  mediumScoreMultiplier: 1.5,
  hardScoreMultiplier: 2.0,
  speedBonusMaxPercent: 0.5,
  streakBonusIncrement: 0.1,
  streakBonusMax: 2.0,
  streakThreshold: 2,
  backgroundColor: '#0f172a',
  colors: {
    correct: '#22c55e',
    incorrect: '#ef4444',
    timeout: '#f59e0b',
    streak: '#f59e0b',
  },
} as const;

export function calculateStreakMultiplier(streak: number): number {
  if (streak <= QUIZ_RUSH_CONFIG.streakThreshold) return 1.0;
  const effective = streak - QUIZ_RUSH_CONFIG.streakThreshold;
  return Math.min(
    1.0 + effective * QUIZ_RUSH_CONFIG.streakBonusIncrement,
    QUIZ_RUSH_CONFIG.streakBonusMax
  );
}

export function getDifficultyMultiplier(d: QuestionDifficulty): number {
  switch (d) {
    case 'easy': return QUIZ_RUSH_CONFIG.easyScoreMultiplier;
    case 'medium': return QUIZ_RUSH_CONFIG.mediumScoreMultiplier;
    case 'hard': return QUIZ_RUSH_CONFIG.hardScoreMultiplier;
  }
}
