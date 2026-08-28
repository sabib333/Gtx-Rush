/**
 * Quiz Rush — Game Configuration
 *
 * All game parameters are centralized here.
 * No magic numbers in gameplay code.
 *
 * GTX Rush — Quiz Rush Game Contract v1.0
 */

// ── Version ──────────────────────────────────────────────────────────
export const QUIZ_RUSH_VERSION = '1.0.0';

// ── Game Modes ───────────────────────────────────────────────────────
export type GameMode = 'normal' | 'daily_challenge' | 'friend_challenge';

// ── Game State Machine ───────────────────────────────────────────────
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

// ── Question Types ───────────────────────────────────────────────────
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionStatus = 'draft' | 'review' | 'published' | 'archived';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  version: number;
  category: string;
  difficulty: QuestionDifficulty;
  question: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  timeLimitMs: number;
  status: QuestionStatus;
}

/** Question sent to the client — correct answer REDACTED */
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

// ── Answer Events ────────────────────────────────────────────────────
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

// ── Answer Result (returned after each answer) ───────────────────────
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

// ── Scoring Result ───────────────────────────────────────────────────
export interface QuizRushGameResult {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;
  highestStreak: number;
  fastestAnswerMs: number;
  slowestAnswerMs: number;
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

// ── Session Data ─────────────────────────────────────────────────────
export interface QuizRushSession {
  sessionId: string;
  gameVersion: string;
  mode: GameMode;
  challengeId?: string;
  opponentUserId?: string;
  targetScore?: number;
  startedAt: number;
  questions: PublicQuestion[];
  questionMap: Map<string, Question>;
  currentQuestionIndex: number;
  score: number;
  streak: number;
  highestStreak: number;
  correctAnswers: number;
  answeredQuestions: Set<string>;
  isComplete: boolean;
  events: InputEvent[];
}

// ── Answered question record ─────────────────────────────────────────
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

// ── Centralized Configuration ────────────────────────────────────────
export const QUIZ_RUSH_CONFIG = {
  // ── Question Selection ───────────────────────────────────
  /** Number of questions per session */
  questionCount: 10,

  /** Default time limit per question (ms) */
  defaultTimeLimitMs: 15_000,

  /** Countdown before first question */
  countdownDuration: 3,

  // ── Scoring ──────────────────────────────────────────────
  /** Base points for a correct answer */
  baseCorrectScore: 500,

  /** Points for easy difficulty */
  easyScoreMultiplier: 1.0,

  /** Points for medium difficulty */
  mediumScoreMultiplier: 1.5,

  /** Points for hard difficulty */
  hardScoreMultiplier: 2.0,

  /** Speed bonus: max percentage of base score for instant answer (0%) */
  speedBonusMaxPercent: 0.5,

  /** Speed bonus: threshold below which speed bonus is 0 (100% of time limit) */
  speedBonusThresholdPercent: 1.0,

  // ── Streak ───────────────────────────────────────────────
  /** Streak bonus multiplier per consecutive correct answer */
  streakBonusIncrement: 0.1,

  /** Maximum streak bonus multiplier */
  streakBonusMax: 2.0,

  /** Streak threshold before bonus kicks in */
  streakThreshold: 2,

  // ── Pause ────────────────────────────────────────────────
  /** Allow pause during normal gameplay */
  allowPause: true,

  /** Allow pause during competitive modes */
  allowPauseInCompetitive: false,

  /** Max pause duration before auto-abort (ms) */
  maxPauseDurationMs: 60_000,

  // ── Anti-Cheat ───────────────────────────────────────────
  /** Minimum time to answer a question (ms) — below this is suspicious */
  minAnswerTimeMs: 500,

  /** Maximum answer time multiplier (of question time limit) */
  maxAnswerTimeMultiplier: 1.5,

  /** Questions to flag for suspicious perfect score */
  suspiciousPerfectScoreThreshold: 0.9,

  // ── Categories ───────────────────────────────────────────
  categories: [
    'general',
    'science',
    'technology',
    'geography',
    'history',
    'sports',
    'entertainment',
    'logic',
  ] as const,

  // ── Visual ───────────────────────────────────────────────
  backgroundColor: '#0f172a',

  colors: {
    correct: '#22c55e',
    incorrect: '#ef4444',
    timeout: '#f59e0b',
    streak: '#f59e0b',
    easy: '#22c55e',
    medium: '#f59e0b',
    hard: '#ef4444',
  },

  // ── UI ───────────────────────────────────────────────────
  maxDisplayScore: 99999,
} as const;

export type QuizRushConfig = typeof QUIZ_RUSH_CONFIG;

// ── Helper: Get score multiplier for difficulty ──────────────────────
export function getDifficultyMultiplier(difficulty: QuestionDifficulty): number {
  switch (difficulty) {
    case 'easy':
      return QUIZ_RUSH_CONFIG.easyScoreMultiplier;
    case 'medium':
      return QUIZ_RUSH_CONFIG.mediumScoreMultiplier;
    case 'hard':
      return QUIZ_RUSH_CONFIG.hardScoreMultiplier;
  }
}

// ── Helper: Calculate streak bonus multiplier ────────────────────────
export function calculateStreakMultiplier(streak: number): number {
  if (streak <= QUIZ_RUSH_CONFIG.streakThreshold) {
    return 1.0;
  }
  const effectiveStreak = streak - QUIZ_RUSH_CONFIG.streakThreshold;
  const raw = 1.0 + effectiveStreak * QUIZ_RUSH_CONFIG.streakBonusIncrement;
  return Math.min(raw, QUIZ_RUSH_CONFIG.streakBonusMax);
}

// ── Helper: Calculate speed bonus ────────────────────────────────────
export function calculateSpeedBonus(
  timeToAnswerMs: number,
  timeLimitMs: number,
  baseScore: number,
): number {
  if (timeToAnswerMs >= timeLimitMs) return 0;
  const ratio = 1 - timeToAnswerMs / timeLimitMs;
  return Math.round(baseScore * ratio * QUIZ_RUSH_CONFIG.speedBonusMaxPercent);
}

// ── Helper: Calculate score for a single answer ──────────────────────
export function calculateAnswerScore(
  isCorrect: boolean,
  difficulty: QuestionDifficulty,
  streak: number,
  timeToAnswerMs: number,
  timeLimitMs: number,
): {
  scoreEarned: number;
  speedBonus: number;
  streakBonus: number;
  difficultyBonus: number;
} {
  if (!isCorrect) {
    return { scoreEarned: 0, speedBonus: 0, streakBonus: 0, difficultyBonus: 0 };
  }

  const difficultyMultiplier = getDifficultyMultiplier(difficulty);
  const baseScore = Math.round(QUIZ_RUSH_CONFIG.baseCorrectScore * difficultyMultiplier);
  const difficultyBonus = baseScore - QUIZ_RUSH_CONFIG.baseCorrectScore;

  const speedBonus = calculateSpeedBonus(timeToAnswerMs, timeLimitMs, baseScore);

  const streakMultiplier = calculateStreakMultiplier(streak);
  const streakBonus = Math.round(baseScore * (streakMultiplier - 1.0));

  const scoreEarned = baseScore + speedBonus + streakBonus;

  return {
    scoreEarned,
    speedBonus,
    streakBonus,
    difficultyBonus,
  };
}

// ── Helper: Shuffle array (Fisher-Yates) ─────────────────────────────
export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

// ── Helper: Create public question (redact correct answer) ───────────
export function toPublicQuestion(
  question: Question,
  sequenceNumber: number,
): PublicQuestion {
  return {
    id: question.id,
    version: question.version,
    category: question.category,
    difficulty: question.difficulty,
    question: question.question,
    options: question.options,
    timeLimitMs: question.timeLimitMs,
    sequenceNumber,
  };
}
