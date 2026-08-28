/**
 * GamePlay Page
 *
 * Handles game selection, launch, countdown, gameplay, and results.
 * Supports Reaction Rush, Tap Rush, and Quiz Rush.
 */

import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameLaunch, Countdown, GameResult } from '@gtx-rush/ui';
import { GameScreen as ReactionRushScreen, useGameSession as useReactionRushSession } from '../games/reaction-rush';
import type { GameResult as ReactionRushResult, InputEvent as ReactionInputEvent } from '../games/reaction-rush';
import { GameScreen as TapRushScreen, useGameSession as useTapRushSession } from '../games/tap-rush';
import type { GameResult as TapRushResult, InputEvent as TapInputEvent } from '../games/tap-rush';
import { GameScreen as QuizRushScreen, ReviewScreen, useGameSession as useQuizRushSession } from '../games/quiz-rush';
import type { GameResult as QuizRushResult, InputEvent as QuizInputEvent } from '../games/quiz-rush';
import type { GameSessionResult as QuizSessionResult } from '../games/quiz-rush';

type PageState = 'launch' | 'countdown' | 'playing' | 'result' | 'review';

const gameConfig: Record<string, {
  name: string;
  icon: string;
  color: 'reaction' | 'tap' | 'quiz';
  description: string;
}> = {
  'reaction-rush': {
    name: 'Reaction Rush',
    icon: '⚡',
    color: 'reaction',
    description: 'Test your reflexes! React as fast as you can.',
  },
  'tap-rush': {
    name: 'Tap Rush',
    icon: '👆',
    color: 'tap',
    description: 'Tap targets as fast and accurately as you can!',
  },
  'quiz-rush': {
    name: 'Quiz Rush',
    icon: '🧠',
    color: 'quiz',
    description: 'Answer questions fast to beat your opponents!',
  },
};

export function GamePlay() {
  const { gameSlug } = useParams<{ gameSlug: string }>();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('launch');
  const [finalResult, setFinalResult] = useState<ReactionRushResult | TapRushResult | QuizRushResult | null>(null);
  const [serverResult, setServerResult] = useState<{
    score: number;
    personalBest: number;
    isPersonalBest: boolean;
    globalRank: number;
    xpAwarded: number;
  } | null>(null);

  const isTapRush = gameSlug === 'tap-rush';
  const isQuizRush = gameSlug === 'quiz-rush';

  const reactionSession = useReactionRushSession();
  const tapSession = useTapRushSession();
  const quizSession = useQuizRushSession();
  // Use typed session accessors to avoid union type issues
  const actionSession = isTapRush ? tapSession : reactionSession;
  const config = gameConfig[gameSlug ?? ''] ?? gameConfig['reaction-rush']!;

  // Check for challenge mode from URL
  const urlParams = new URLSearchParams(window.location.search);
  const challengeId = urlParams.get('challenge') ?? undefined;
  const gameMode = (challengeId ? 'friend_challenge' : 'normal') as string;

  // Create session on start
  const handleStart = useCallback(async () => {
    const activeSession = isQuizRush ? quizSession : actionSession;
    const sessionData = await activeSession.createSession(gameMode as any, challengeId);
    if (sessionData) {
      setPageState('countdown');
    }
  }, [isQuizRush, quizSession, actionSession, gameMode, challengeId]);

  // Countdown complete
  const handleCountdownComplete = useCallback(() => {
    setPageState('playing');
  }, []);

  // Game complete for action games (reaction-rush, tap-rush)
  const handleActionGameComplete = useCallback(async (result: ReactionRushResult | TapRushResult, events: ReactionInputEvent[] | TapInputEvent[]) => {
    setFinalResult(result);

    const serverRes = await actionSession.submitResult(events as never, result.durationMs);
    if (serverRes) {
      setServerResult(serverRes);
    }

    setPageState('result');
  }, [actionSession]);

  // Quiz Rush: complete session
  const handleQuizComplete = useCallback(async () => {
    const result = await quizSession.completeSession();
    if (result) {
      setFinalResult({
        score: result.score,
        correctAnswers: result.correctAnswers,
        totalQuestions: result.totalQuestions,
        accuracy: result.accuracy,
        highestStreak: result.highestStreak,
        fastestAnswerMs: result.fastestAnswerMs,
        breakdown: result.breakdown as any,
        metadata: result.metadata,
        events: [],
        durationMs: 0,
      });
      setServerResult({
        score: result.score,
        personalBest: result.personalBest,
        isPersonalBest: result.isPersonalBest,
        globalRank: result.globalRank,
        xpAwarded: result.xpAwarded,
      });
      setPageState('result');
    }
  }, [quizSession]);

  // Quiz Rush: submit answer (called per-question)
  const handleQuizAnswer = useCallback(
    async (questionId: string, selectedOptionId: string, timeToAnswerMs: number, sequenceNumber: number) => {
      return quizSession.submitAnswer(questionId, selectedOptionId, timeToAnswerMs, sequenceNumber);
    },
    [quizSession],
  );

  // Play again
  const handlePlayAgain = useCallback(() => {
    setFinalResult(null);
    setServerResult(null);
    if (isQuizRush) {
      quizSession.reset();
    } else {
      actionSession.reset();
    }
    setPageState('launch');
  }, [isQuizRush, quizSession, actionSession]);

  // Exit
  const handleExit = useCallback(() => {
    navigate('/games');
  }, [navigate]);

  // Share score
  const handleShare = useCallback(() => {
    if (!finalResult) return;
    const gameName = config.name;
    const text = `🧠 I scored ${finalResult.score.toLocaleString()} in ${gameName}!\n\nCan you beat me? Play. Compete. Rise. ⚡`;
    if (navigator.share) {
      navigator.share({ title: 'GTX Rush', text });
    } else {
      navigator.clipboard?.writeText(text);
    }
  }, [finalResult, config.name]);

  // Challenge friend
  const handleChallengeFriend = useCallback(() => {
    navigate('/games');
  }, [navigate]);

  // ── Launch Screen ──────────────────────────────────────────────────
  if (pageState === 'launch') {
    return (
      <GameLaunch
        gameName={config.name}
        gameIcon={config.icon}
        gameColor={config.color}
        description={config.description}
        bestScore={serverResult?.personalBest ?? 0}
        globalRank={serverResult?.globalRank ?? undefined}
        onStart={handleStart}
        onBack={handleExit}
      />
    );
  }

  // ── Countdown ──────────────────────────────────────────────────────
  if (pageState === 'countdown') {
    return <Countdown onComplete={handleCountdownComplete} />;
  }

  // ── Review Screen ──────────────────────────────────────────────────
  if (pageState === 'review' && isQuizRush) {
    return (
      <ReviewScreen
        answers={quizSession.answeredQuestions}
        onBack={() => setPageState('result')}
        onPlayAgain={handlePlayAgain}
      />
    );
  }

  // ── Playing: Quiz Rush ─────────────────────────────────────────────
  if (pageState === 'playing' && isQuizRush && quizSession.sessionId) {
    return (
      <QuizRushScreen
        session={{
          sessionId: quizSession.sessionId,
          gameVersion: '1.0.0',
          mode: gameMode as any,
          challengeId,
        }}
        gameMode={gameMode as any}
        currentQuestion={quizSession.currentQuestion}
        questionsTotal={quizSession.questionsTotal}
        questionsAnswered={quizSession.questionsAnswered}
        onAnswer={handleQuizAnswer}
        onComplete={handleQuizComplete}
        onGameComplete={() => {}}
        onExit={handleExit}
      />
    );
  }

  // ── Playing: Action games ──────────────────────────────────────────
  if (pageState === 'playing' && actionSession.sessionId) {
    const sessionData = {
      sessionId: actionSession.sessionId,
      gameVersion: '1.0.0',
      mode: gameMode,
      challengeId,
    };

    if (isTapRush) {
      return (
        <TapRushScreen
          session={sessionData as any}
          gameMode={gameMode as any}
          onGameComplete={handleActionGameComplete as any}
          onExit={handleExit}
        />
      );
    }

    return (
      <ReactionRushScreen
        session={sessionData as any}
        gameMode={gameMode as any}
        onGameComplete={handleActionGameComplete as any}
        onExit={handleExit}
      />
    );
  }

  // ── Result ─────────────────────────────────────────────────────────
  if (pageState === 'result' && finalResult) {
    let breakdown: Record<string, number>;

    if (isQuizRush && 'correctAnswers' in finalResult) {
      const qr = finalResult as QuizRushResult;
      breakdown = {
        correctAnswers: qr.correctAnswers,
        totalQuestions: qr.totalQuestions,
        accuracy: qr.accuracy,
        highestStreak: qr.highestStreak,
        fastestAnswerMs: qr.fastestAnswerMs,
      };
    } else if (isTapRush && 'validTaps' in finalResult) {
      const tr = finalResult as TapRushResult;
      breakdown = {
        validTaps: tr.validTaps,
        invalidTaps: tr.invalidTaps,
        accuracy: tr.accuracy,
        highestCombo: tr.highestCombo,
        tapsPerSecond: tr.tapsPerSecond,
        bonusTaps: tr.bonusTaps,
      };
    } else if ('averageReactionTime' in finalResult) {
      const rr = finalResult as ReactionRushResult;
      breakdown = {
        averageReaction: rr.averageReactionTime,
        bestReaction: rr.bestReactionTime,
        accuracy: rr.accuracy,
        falseStarts: rr.falseStarts,
        roundsCompleted: rr.completedRounds,
        totalRounds: rr.totalRounds,
        speedBonus: (rr.breakdown as any).speedBonus ?? 0,
      };
    } else {
      breakdown = {};
    }

    return (
      <div className="min-h-dvh bg-surface-base">
        <GameResult
          score={finalResult.score}
          rank={serverResult?.globalRank}
          isPersonalBest={serverResult?.isPersonalBest ?? false}
          xpAwarded={serverResult?.xpAwarded ?? 0}
          levelUp={false}
          gameName={config.name}
          onPlayAgain={handlePlayAgain}
          onChallengeFriend={handleChallengeFriend}
          onShare={handleShare}
          onBack={handleExit}
          breakdown={breakdown}
        />
        {/* Quiz Rush: Review Answers button */}
        {isQuizRush && (
          <div className="px-6 pb-4 -mt-2">
            <button
              onClick={() => setPageState('review')}
              className="w-full py-3 rounded-xl bg-surface-elevated text-body font-medium text-txt-secondary hover:text-white transition-colors"
            >
              📋 Review Answers
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Error / Loading ────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-surface-base flex items-center justify-center">
      <div className="text-center px-6">
        <div className="text-4xl mb-4">{config.icon}</div>
        <p className="text-body text-txt-primary mb-2">Loading {config.name}...</p>
        {(isQuizRush ? quizSession.hasError : actionSession.hasError) && (
          <p className="text-caption text-error mb-4">{isQuizRush ? quizSession.error : actionSession.error}</p>
        )}
        <button
          onClick={handleExit}
          className="text-caption text-txt-tertiary underline"
        >
          Back to Games
        </button>
      </div>
    </div>
  );
}
