/**
 * Quiz Rush — Game Engine Types
 *
 * Types used by the shared game engine framework.
 */

export interface QuizRushInput {
  type: 'answer' | 'timeout' | 'session_started' | 'session_finished';
  data: {
    questionId?: string;
    questionSequence?: number;
    selectedOptionId?: string;
    timeToAnswerMs?: number;
    [key: string]: unknown;
  };
}

export interface QuizRushResult {
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
}
