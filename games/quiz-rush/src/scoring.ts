/**
 * Quiz Rush — Server-Side Scoring
 *
 * This module calculates scores from raw input events.
 * The score is NEVER trusted from the client.
 *
 * The server reconstructs the entire game from submitted events,
 * looks up correct answers from its own question database,
 * and calculates the authoritative score.
 */

import type { GameInput, GameResult as TypesGameResult } from '@gtx-rush/types';
import {
  QUIZ_RUSH_CONFIG,
  calculateAnswerScore,
} from './config';
import type { InputEvent, Question, QuestionDifficulty, AnsweredQuestion } from './config';

/**
 * Reconstruct answer events from raw GameInput[].
 */
export function reconstructEvents(inputs: GameInput[]): InputEvent[] {
  const events: InputEvent[] = [];

  for (const input of inputs) {
    const data = input.data as Record<string, unknown>;

    const event: InputEvent = {
      type: input.type as InputEvent['type'],
      timestamp: input.timestamp,
    };

    if (data.questionId) event.questionId = data.questionId as string;
    if (data.questionSequence != null) event.questionSequence = data.questionSequence as number;
    if (data.selectedOptionId) event.selectedOptionId = data.selectedOptionId as string;
    if (data.timeToAnswerMs != null) event.timeToAnswerMs = data.timeToAnswerMs as number;

    events.push(event);
  }

  return events;
}

/**
 * Reconstruct answered questions from events + question map.
 * Used by the server to rebuild gameplay for scoring.
 */
export function reconstructAnswers(
  events: InputEvent[],
  questionMap: Map<string, Question>,
): AnsweredQuestion[] {
  const answers: AnsweredQuestion[] = [];

  for (const event of events) {
    if (event.type === 'answer_submitted' || event.type === 'timeout') {
      const question = questionMap.get(event.questionId ?? '');
      if (!question) continue;

      const selectedOptionId = event.type === 'timeout' ? null : (event.selectedOptionId ?? null);
      const correct = selectedOptionId === question.correctOptionId;

      answers.push({
        questionId: question.id,
        question: question.question,
        category: question.category,
        difficulty: question.difficulty,
        selectedOptionId,
        correctOptionId: question.correctOptionId,
        options: question.options,
        correct,
        timeToAnswerMs: event.timeToAnswerMs ?? question.timeLimitMs,
        explanation: question.explanation,
      });
    }
  }

  return answers;
}

/**
 * Calculate score from raw game inputs (server-side).
 * Derives duration from the input timestamps.
 * Used by the BaseGame framework.
 */
export function calculateScore(inputs: GameInput[]): TypesGameResult {
  // For BaseGame compatibility, we use a simplified calculation
  // In practice, the API routes use calculateServerScore with the question map
  const events = reconstructEvents(inputs);

  let score = 0;
  let correctAnswers = 0;
  let streak = 0;
  let highestStreak = 0;
  let fastestAnswerMs = Infinity;
  const totalQuestions = events.filter(
    (e) => e.type === 'answer_submitted' || e.type === 'timeout'
  ).length;

  for (const event of events) {
    if (event.type === 'answer_submitted') {
      // Without the question map, we assume correct answers get base score
      // The API route uses the full calculateServerScore for authoritative scoring
      correctAnswers++;
      streak++;
      highestStreak = Math.max(highestStreak, streak);
      const timeMs = event.timeToAnswerMs ?? QUIZ_RUSH_CONFIG.defaultTimeLimitMs;
      fastestAnswerMs = Math.min(fastestAnswerMs, timeMs);
      score += QUIZ_RUSH_CONFIG.baseCorrectScore;
    } else if (event.type === 'timeout') {
      streak = 0;
    }
  }

  const durationMs = inputs.length > 1
    ? inputs[inputs.length - 1]!.timestamp - inputs[0]!.timestamp
    : 0;

  return {
    score,
    breakdown: {
      baseScore: correctAnswers * QUIZ_RUSH_CONFIG.baseCorrectScore,
      speedBonus: 0,
      streakBonus: 0,
      difficultyBonus: 0,
    },
    metadata: {
      correctAnswers,
      totalQuestions,
      accuracy: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
      highestStreak,
      fastestAnswerMs: fastestAnswerMs === Infinity ? 0 : fastestAnswerMs,
    },
    antiCheatFlags: [],
    durationMs,
    inputCount: inputs.length,
  };
}

/**
 * Calculate authoritative score with full question data.
 * This is the definitive scoring function used by the API routes.
 */
export function calculateServerScore(
  events: InputEvent[],
  questionMap: Map<string, Question>,
): {
  result: TypesGameResult;
  answers: AnsweredQuestion[];
  breakdown: {
    baseScore: number;
    speedBonus: number;
    streakBonus: number;
    difficultyBonus: number;
  };
} {
  const answers = reconstructAnswers(events, questionMap);
  let score = 0;
  let streak = 0;
  let highestStreak = 0;
  let fastestAnswerMs = Infinity;
  let slowestAnswerMs = 0;
  let baseScore = 0;
  let totalSpeedBonus = 0;
  let totalStreakBonus = 0;
  let totalDifficultyBonus = 0;

  const sessionStart = events.find((e) => e.type === 'session_started')?.timestamp ?? 0;

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question) continue;

    if (answer.correct) {
      streak++;
      highestStreak = Math.max(highestStreak, streak);

      const { scoreEarned, speedBonus, streakBonus, difficultyBonus } = calculateAnswerScore(
        true,
        question.difficulty,
        streak,
        answer.timeToAnswerMs,
        question.timeLimitMs,
      );

      score += scoreEarned;
      baseScore += QUIZ_RUSH_CONFIG.baseCorrectScore;
      totalSpeedBonus += speedBonus;
      totalStreakBonus += streakBonus;
      totalDifficultyBonus += difficultyBonus;
      fastestAnswerMs = Math.min(fastestAnswerMs, answer.timeToAnswerMs);
    } else {
      streak = 0;
    }

    slowestAnswerMs = Math.max(slowestAnswerMs, answer.timeToAnswerMs);
  }

  const correctAnswers = answers.filter((a) => a.correct).length;
  const totalQuestions = answers.length;
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const durationMs = events.length > 0
    ? (events[events.length - 1]!.timestamp - sessionStart)
    : 0;

  const breakdown = {
    baseScore,
    speedBonus: totalSpeedBonus,
    streakBonus: totalStreakBonus,
    difficultyBonus: totalDifficultyBonus,
  };

  const result: TypesGameResult = {
    score,
    breakdown: breakdown as unknown as Record<string, number>,
    metadata: {
      correctAnswers,
      totalQuestions,
      accuracy,
      highestStreak,
      fastestAnswerMs: fastestAnswerMs === Infinity ? 0 : fastestAnswerMs,
      slowestAnswerMs,
    },
    antiCheatFlags: [],
    durationMs,
    inputCount: events.length,
  };

  return { result, answers, breakdown };
}

/**
 * Validate that an input sequence is structurally valid.
 */
export function validateInputSequence(inputs: GameInput[]): {
  valid: boolean;
  error?: string;
} {
  if (inputs.length === 0) {
    return { valid: false, error: 'No inputs provided' };
  }

  const validTypes = new Set([
    'session_started',
    'question_shown',
    'answer_submitted',
    'timeout',
    'session_finished',
  ]);

  for (const input of inputs) {
    if (!validTypes.has(input.type)) {
      return { valid: false, error: `Invalid event type: ${input.type}` };
    }
  }

  // First event must be session_started
  if (inputs[0]!.type !== 'session_started') {
    return { valid: false, error: 'First event must be session_started' };
  }

  // Timestamps should be monotonically non-decreasing
  for (let i = 1; i < inputs.length; i++) {
    if (inputs[i]!.timestamp < inputs[i - 1]!.timestamp) {
      return { valid: false, error: `Timestamps out of order at index ${i}` };
    }
  }

  // No duplicate answers for same question
  const answeredQuestions = new Set<string>();
  for (const input of inputs) {
    if (input.type === 'answer_submitted' || input.type === 'timeout') {
      const questionId = (input.data as Record<string, unknown>).questionId as string;
      if (answeredQuestions.has(questionId)) {
        return { valid: false, error: `Duplicate answer for question: ${questionId}` };
      }
      answeredQuestions.add(questionId);
    }
  }

  return { valid: true };
}
