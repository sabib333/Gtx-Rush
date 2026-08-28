/**
 * Quiz Rush — Game Screen
 *
 * The core gameplay screen. Handles:
 * - Question display with readable mobile layout
 * - Per-question countdown timer (monotonic)
 * - Answer selection with lock-after-tap
 * - Correct/incorrect visual feedback
 * - Streak tracking and display
 * - Question transitions
 * - Timeout handling
 *
 * Flow:
 * 1. Show question with timer
 * 2. Player selects answer → lock options
 * 3. Show feedback (correct/incorrect + explanation)
 * 4. Auto-advance to next question
 * 5. After last question → complete game
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { GameHeader } from '@gtx-rush/ui';
import type {
  PublicQuestion,
  InputEvent,
  GameSession,
  GameState,
  GameMode,
  GameResult,
} from './types';
import { QUIZ_RUSH_CONFIG } from './config';
import type { AnswerResult } from './useGameSession';

interface GameScreenProps {
  session: GameSession;
  gameMode: GameMode;
  currentQuestion: PublicQuestion | null;
  questionsTotal: number;
  questionsAnswered: number;
  onAnswer: (
    questionId: string,
    selectedOptionId: string,
    timeToAnswerMs: number,
    sequenceNumber: number,
  ) => Promise<AnswerResult | null>;
  onComplete: () => void;
  onGameComplete: (result: GameResult, events: InputEvent[]) => void;
  onExit: () => void;
}

export function GameScreen({
  session,
  gameMode,
  currentQuestion,
  questionsTotal,
  questionsAnswered,
  onAnswer,
  onComplete,
  onGameComplete,
  onExit,
}: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>('question_active');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeFraction, setTimeFraction] = useState(1);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    scoreEarned: number;
    streak: number;
    explanation: string;
    correctOptionId: string;
  } | null>(null);
  const [streak, setStreak] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  const questionStartTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnsweringRef = useRef(false);
  const eventsRef = useRef<InputEvent[]>([]);
  const questionIndexRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    };
  }, []);

  // Start a new question
  const startQuestion = useCallback((question: PublicQuestion) => {
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOption(null);
    setFeedback(null);
    setGameState('question_active');
    isAnsweringRef.current = false;
    questionStartTimeRef.current = performance.now();

    // Record question shown event
    eventsRef.current.push({
      type: 'question_shown',
      timestamp: performance.now(),
      questionId: question.id,
      questionSequence: question.sequenceNumber,
    });

    // Start timer
    const totalMs = question.timeLimitMs;
    let remaining = totalMs;
    setTimeLeft(Math.ceil(remaining / 1000));
    setTimeFraction(1);

    timerRef.current = setInterval(() => {
      remaining -= 100;
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        remaining = 0;
        // Timeout — auto-submit
        handleTimeout(question);
      }
      setTimeLeft(Math.ceil(remaining / 1000));
      setTimeFraction(Math.max(0, remaining / totalMs));
    }, 100);
  }, []);

  // Handle timeout
  const handleTimeout = useCallback(
    async (question: PublicQuestion) => {
      if (isAnsweringRef.current) return;
      isAnsweringRef.current = true;

      const timeToAnswerMs = question.timeLimitMs;

      eventsRef.current.push({
        type: 'timeout',
        timestamp: performance.now(),
        questionId: question.id,
        questionSequence: question.sequenceNumber,
        timeToAnswerMs,
      });

      setGameState('answer_submitted');
      setFeedback({
        correct: false,
        scoreEarned: 0,
        streak: 0,
        explanation: 'Time\'s up!',
        correctOptionId: '',
      });

      // Get result from server
      const result = await onAnswer(question.id, '', timeToAnswerMs, question.sequenceNumber);
      if (result) {
        setFeedback({
          correct: result.correct,
          scoreEarned: result.scoreEarned,
          streak: result.streak,
          explanation: result.explanation,
          correctOptionId: result.correctOptionId,
        });
        if (result.correct) {
          setStreak(result.streak);
          setTotalScore((prev) => prev + result.scoreEarned);
        }
      }

      // Check if game is complete
      if (result && result.questionsRemaining === 0) {
        transitionTimeoutRef.current = setTimeout(async () => {
          setGameState('game_complete');
          const completedResult = await onComplete();
        }, 1500);
      } else {
        // Transition to next question
        transitionTimeoutRef.current = setTimeout(() => {
          setGameState('next_question');
        }, 1500);
      }
    },
    [onAnswer, onComplete],
  );

  // Handle answer selection
  const handleAnswerSelect = useCallback(
    async (optionId: string) => {
      if (!currentQuestion || isAnsweringRef.current || gameState !== 'question_active') return;
      isAnsweringRef.current = true;

      if (timerRef.current) clearInterval(timerRef.current);

      const timeToAnswerMs = performance.now() - questionStartTimeRef.current;
      setSelectedOption(optionId);

      // Record answer event
      eventsRef.current.push({
        type: 'answer_submitted',
        timestamp: performance.now(),
        questionId: currentQuestion.id,
        questionSequence: currentQuestion.sequenceNumber,
        selectedOptionId: optionId,
        timeToAnswerMs,
      });

      setGameState('answer_submitted');

      // Get result from server
      const result = await onAnswer(
        currentQuestion.id,
        optionId,
        timeToAnswerMs,
        currentQuestion.sequenceNumber,
      );

      if (result) {
        setFeedback({
          correct: result.correct,
          scoreEarned: result.scoreEarned,
          streak: result.streak,
          explanation: result.explanation,
          correctOptionId: result.correctOptionId,
        });
        if (result.correct) {
          setStreak(result.streak);
          setTotalScore((prev) => prev + result.scoreEarned);
        } else {
          setStreak(0);
        }
      }

      // Check if game is complete
      if (result && result.questionsRemaining === 0) {
        transitionTimeoutRef.current = setTimeout(async () => {
          setGameState('game_complete');
          await onComplete();
        }, 2000);
      } else {
        // Transition to next question
        transitionTimeoutRef.current = setTimeout(() => {
          setGameState('next_question');
        }, 2000);
      }
    },
    [currentQuestion, gameState, onAnswer, onComplete],
  );

  // Start question when currentQuestion changes
  useEffect(() => {
    if (currentQuestion && gameState === 'question_active') {
      startQuestion(currentQuestion);
    }
  }, [currentQuestion]);

  // Initial start
  useEffect(() => {
    if (currentQuestion && questionIndexRef.current === 0) {
      questionIndexRef.current = 1;
      startQuestion(currentQuestion);
    }
  }, [currentQuestion]);

  if (!currentQuestion) {
    return (
      <div className="min-h-dvh bg-surface-base flex items-center justify-center">
        <p className="text-body text-txt-secondary">Loading question...</p>
      </div>
    );
  }

  const timerColor =
    timeFraction > 0.5
      ? 'text-green-400'
      : timeFraction > 0.25
        ? 'text-amber-400'
        : 'text-red-400';

  const difficultyColor =
    currentQuestion.difficulty === 'easy'
      ? 'text-green-400 bg-green-500/10'
      : currentQuestion.difficulty === 'medium'
        ? 'text-amber-400 bg-amber-500/10'
        : 'text-red-400 bg-red-500/10';

  return (
    <div className="min-h-dvh bg-surface-base flex flex-col">
      {/* Header */}
      <GameHeader
        title="Quiz Rush"
        score={totalScore}
        round={questionsAnswered + (gameState === 'answer_submitted' ? 1 : 0)}
        totalRounds={questionsTotal}
        onPause={() => {}}
        onExit={onExit}
        showPause={false}
      />

      {/* Streak indicator */}
      {streak >= QUIZ_RUSH_CONFIG.streakThreshold && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-amber-500/20 border border-amber-500/40 rounded-full px-3 py-1 animate-pulse">
            <span className="text-caption font-bold text-amber-400 tabular-nums">
              🔥 {streak}× STREAK
            </span>
          </div>
        </div>
      )}

      {/* Question area */}
      <div className="flex-1 flex flex-col px-5 pt-4 pb-4 overflow-y-auto">
        {/* Category & difficulty */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-caption text-txt-tertiary uppercase tracking-wider">
            {currentQuestion.category}
          </span>
          <span className={`text-caption-xs px-2 py-0.5 rounded-full ${difficultyColor}`}>
            {currentQuestion.difficulty.toUpperCase()}
          </span>
        </div>

        {/* Timer bar */}
        <div className="w-full h-2 bg-surface-elevated rounded-full mb-5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100 ease-linear"
            style={{
              width: `${timeFraction * 100}%`,
              backgroundColor:
                timeFraction > 0.5
                  ? '#22c55e'
                  : timeFraction > 0.25
                    ? '#f59e0b'
                    : '#ef4444',
            }}
          />
        </div>

        {/* Timer text */}
        <div className="text-center mb-5">
          <span className={`text-score font-score tabular-nums ${timerColor}`}>
            {(timeLeft / 10).toFixed(1)}s
          </span>
        </div>

        {/* Question */}
        <div className="mb-6">
          <h2 className="text-h2 font-display text-white leading-snug">
            {currentQuestion.question}
          </h2>
        </div>

        {/* Answer options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedOption === option.id;
            const isCorrectOption = feedback?.correctOptionId === option.id;
            const showResult = gameState === 'answer_submitted' && feedback;

            let borderColor = 'border-surface-elevated';
            let bgColor = 'bg-surface-raised';
            let textColor = 'text-white';

            if (showResult) {
              if (isCorrectOption) {
                borderColor = 'border-green-500';
                bgColor = 'bg-green-500/20';
                textColor = 'text-green-400';
              } else if (isSelected && !feedback.correct) {
                borderColor = 'border-red-500';
                bgColor = 'bg-red-500/20';
                textColor = 'text-red-400';
              } else {
                bgColor = 'bg-surface-raised/50';
                textColor = 'text-txt-tertiary';
              }
            } else if (isSelected) {
              borderColor = 'border-accent-400';
              bgColor = 'bg-accent-400/10';
            }

            return (
              <button
                key={option.id}
                onClick={() => handleAnswerSelect(option.id)}
                disabled={gameState !== 'question_active'}
                className={`w-full text-left px-4 py-4 rounded-xl border-2 ${borderColor} ${bgColor} ${textColor} transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed`}
              >
                <span className="text-body font-medium">{option.text}</span>
                {showResult && isCorrectOption && (
                  <span className="ml-2 text-green-400">✓</span>
                )}
                {showResult && isSelected && !feedback.correct && (
                  <span className="ml-2 text-red-400">✗</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback area */}
        {feedback && (
          <div className={`mt-5 p-4 rounded-xl ${
            feedback.correct
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">
                {feedback.correct ? '✅' : '❌'}
              </span>
              <span className={`text-body font-bold ${
                feedback.correct ? 'text-green-400' : 'text-red-400'
              }`}>
                {feedback.correct ? 'Correct!' : 'Incorrect'}
              </span>
              {feedback.scoreEarned > 0 && (
                <span className="text-body font-bold text-white ml-auto">
                  +{feedback.scoreEarned}
                </span>
              )}
            </div>
            {feedback.explanation && (
              <p className="text-caption text-txt-secondary leading-relaxed">
                {feedback.explanation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom stats bar */}
      <div className="flex items-center justify-around px-4 py-2 bg-surface-raised">
        <div className="text-center">
          <div className="text-caption-xs text-txt-tertiary">Score</div>
          <div className="text-body font-bold text-white tabular-nums">
            {totalScore.toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-caption-xs text-txt-tertiary">Streak</div>
          <div className={`text-body font-bold tabular-nums ${
            streak >= QUIZ_RUSH_CONFIG.streakThreshold ? 'text-amber-400' : 'text-white'
          }`}>
            {streak}×
          </div>
        </div>
        <div className="text-center">
          <div className="text-caption-xs text-txt-tertiary">Progress</div>
          <div className="text-body font-bold text-white tabular-nums">
            {questionsAnswered + (gameState === 'answer_submitted' ? 1 : 0)}/{questionsTotal}
          </div>
        </div>
      </div>
    </div>
  );
}
