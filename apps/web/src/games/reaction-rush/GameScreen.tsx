/**
 * Reaction Rush — Game Screen
 *
 * The core gameplay screen. Handles:
 * - Target spawning at random positions with random delays
 * - Reaction time measurement using DOMHighResTimeStamp
 * - False start detection
 * - Round progression
 * - Score calculation
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { GameHeader } from '@gtx-rush/ui';
import type { RoundData, InputEvent, GameSession, GameState, GameMode, GameResult } from './types';
import { REACTION_RUSH_CONFIG, calculateGameResult } from './config';

interface GameScreenProps {
  session: GameSession;
  gameMode: GameMode;
  onGameComplete: (result: GameResult, events: InputEvent[]) => void;
  onExit: () => void;
}

type TargetState = 'none' | 'waiting' | 'active';

export function GameScreen({ session, gameMode, onGameComplete, onExit }: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [targetState, setTargetState] = useState<TargetState>('none');
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0 });
  const [currentRound, setCurrentRound] = useState(1);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [timeLeft, setTimeLeft] = useState(REACTION_RUSH_CONFIG.totalRounds);
  const [score, setScore] = useState(0);
  const [showFeedback, setShowFeedback] = useState<'hit' | 'false' | null>(null);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const targetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const targetActivatedAtRef = useRef<number>(0);
  const eventsRef = useRef<InputEvent[]>([]);
  const roundsRef = useRef<RoundData[]>([]);
  const isFalseStartRef = useRef(false);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (targetTimeoutRef.current) clearTimeout(targetTimeoutRef.current);
      if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // Get random position for the target
  const getRandomPosition = useCallback(() => {
    if (!gameAreaRef.current) return { x: 150, y: 200 };
    const rect = gameAreaRef.current.getBoundingClientRect();
    const targetSize = 80;
    const margin = REACTION_RUSH_CONFIG.targetMarginPx;
    const x = margin + Math.random() * (rect.width - targetSize - margin * 2);
    const y = margin + Math.random() * (rect.height - targetSize - margin * 2);
    return { x, y };
  }, []);

  // Start a new round
  const startRound = useCallback((roundNumber: number) => {
    setCurrentRound(roundNumber);
    setTargetState('waiting');
    isFalseStartRef.current = false;

    // Record round start event
    const event: InputEvent = {
      type: 'round_started',
      timestamp: performance.now(),
      roundNumber,
    };
    eventsRef.current.push(event);

    // Random delay before target appears
    const delay = REACTION_RUSH_CONFIG.minDelayMs +
      Math.random() * (REACTION_RUSH_CONFIG.maxDelayMs - REACTION_RUSH_CONFIG.minDelayMs);

    delayTimeoutRef.current = setTimeout(() => {
      // Spawn target
      const pos = getRandomPosition();
      setTargetPosition(pos);
      setTargetState('active');
      targetActivatedAtRef.current = performance.now();

      // Record target activation event
      const activateEvent: InputEvent = {
        type: 'target_activated',
        timestamp: performance.now(),
        roundNumber,
      };
      eventsRef.current.push(activateEvent);

      // Target timeout — player missed
      targetTimeoutRef.current = setTimeout(() => {
        if (targetState !== 'active') return;

        // Round missed
        const roundData: RoundData = {
          roundNumber,
          targetActivatedAt: targetActivatedAtRef.current,
          targetTappedAt: null,
          reactionTimeMs: null,
          isFalseStart: false,
          events: eventsRef.current.filter((e) => e.roundNumber === roundNumber),
        };
        roundsRef.current.push(roundData);
        setRounds([...roundsRef.current]);
        setTargetState('none');

        // Move to next round
        if (roundNumber < REACTION_RUSH_CONFIG.totalRounds) {
          startRound(roundNumber + 1);
        } else {
          completeGame();
        }
      }, REACTION_RUSH_CONFIG.targetTimeoutMs);
    }, delay);
  }, [getRandomPosition, targetState]);

  // Handle target tap
  const handleTargetTap = useCallback(() => {
    if (targetState !== 'active') return;

    const reactionTime = performance.now() - targetActivatedAtRef.current;

    // Clear timeout
    if (targetTimeoutRef.current) clearTimeout(targetTimeoutRef.current);

    // Record tap event
    const tapEvent: InputEvent = {
      type: 'target_tapped',
      timestamp: performance.now(),
      roundNumber: currentRound,
      data: { reactionTimeMs: reactionTime },
    };
    eventsRef.current.push(tapEvent);

    // Record round result
    const roundData: RoundData = {
      roundNumber: currentRound,
      targetActivatedAt: targetActivatedAtRef.current,
      targetTappedAt: performance.now(),
      reactionTimeMs: reactionTime,
      isFalseStart: false,
      events: eventsRef.current.filter((e) => e.roundNumber === currentRound),
    };
    roundsRef.current.push(roundData);
    setRounds([...roundsRef.current]);

    // Show feedback
    setTargetState('none');
    setShowFeedback('hit');
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setShowFeedback(null), 600);

    // Next round
    if (currentRound < REACTION_RUSH_CONFIG.totalRounds) {
      setTimeout(() => startRound(currentRound + 1), 800);
    } else {
      setTimeout(() => completeGame(), 800);
    }
  }, [targetState, currentRound, startRound]);

  // Handle false start (tapping when target is not active)
  const handleFalseStart = useCallback(() => {
    if (targetState === 'active') return; // This is a valid tap
    if (gameState !== 'waiting') return;

    isFalseStartRef.current = true;

    // Record false start event
    const event: InputEvent = {
      type: 'false_start',
      timestamp: performance.now(),
      roundNumber: currentRound,
    };
    eventsRef.current.push(event);

    // Show feedback
    setShowFeedback('false');
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setShowFeedback(null), 600);

    // Record round as false start
    const roundData: RoundData = {
      roundNumber: currentRound,
      targetActivatedAt: null,
      targetTappedAt: null,
      reactionTimeMs: null,
      isFalseStart: true,
      events: eventsRef.current.filter((e) => e.roundNumber === currentRound),
    };
    roundsRef.current.push(roundData);
    setRounds([...roundsRef.current]);

    // Clear any pending target spawn
    if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
    if (targetTimeoutRef.current) clearTimeout(targetTimeoutRef.current);
    setTargetState('none');

    // Next round
    if (currentRound < REACTION_RUSH_CONFIG.totalRounds) {
      setTimeout(() => startRound(currentRound + 1), 800);
    } else {
      setTimeout(() => completeGame(), 800);
    }
  }, [targetState, gameState, currentRound, startRound]);

  // Complete the game
  const completeGame = useCallback(() => {
    setGameState('game_complete');
    const endedAt = performance.now();
    const result = calculateGameResult(roundsRef.current, startTimeRef.current, endedAt);
    onGameComplete(result, eventsRef.current);
  }, [onGameComplete]);

  // Start the game
  useEffect(() => {
    if (gameState === 'waiting') {
      startTimeRef.current = performance.now();
      startRound(1);
      setGameState('playing');
    }
  }, [gameState, startRound]);

  // Calculate display score from rounds
  const displayScore = rounds.reduce((sum, r) => {
    if (r.isFalseStart) return sum - REACTION_RUSH_CONFIG.falseStartPenalty;
    if (r.reactionTimeMs === null) return sum;
    const normalized = 1 - (r.reactionTimeMs - REACTION_RUSH_CONFIG.minReactionTimeMs) /
      (REACTION_RUSH_CONFIG.maxReactionTimeMs - REACTION_RUSH_CONFIG.minReactionTimeMs);
    const roundScore = Math.round(Math.max(0, normalized) * 1000);
    const speedBonus = r.reactionTimeMs < REACTION_RUSH_CONFIG.speedBonusThresholdMs
      ? REACTION_RUSH_CONFIG.speedBonusPoints : 0;
    return sum + roundScore + speedBonus;
  }, 0);

  return (
    <div className="min-h-dvh bg-surface-base flex flex-col">
      {/* Header */}
      <GameHeader
        title="Reaction Rush"
        score={Math.max(0, displayScore)}
        timeLeft={timeLeft}
        onPause={() => setGameState('paused')}
        onExit={onExit}
      />

      {/* Game Area */}
      <div
        ref={gameAreaRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ background: REACTION_RUSH_CONFIG.backgroundColor }}
        onClick={targetState === 'active' ? handleTargetTap : handleFalseStart}
      >
        {/* Round indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-surface-elevated/80 backdrop-blur-sm rounded-pill px-4 py-1.5">
            <span className="text-caption font-mono text-txt-secondary">
              ROUND {currentRound} / {REACTION_RUSH_CONFIG.totalRounds}
            </span>
          </div>
        </div>

        {/* Waiting state */}
        {targetState === 'waiting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div
                className="w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: REACTION_RUSH_CONFIG.targetColors.waiting + '20' }}
              >
                <div
                  className="w-24 h-24 rounded-full"
                  style={{ background: REACTION_RUSH_CONFIG.targetColors.waiting + '40' }}
                />
              </div>
              <p className="text-body text-txt-tertiary animate-pulse">Wait for green...</p>
            </div>
          </div>
        )}

        {/* Target */}
        {targetState === 'active' && (
          <div
            className="absolute cursor-pointer z-20 transition-opacity duration-75"
            style={{
              left: targetPosition.x,
              top: targetPosition.y,
              width: 80,
              height: 80,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTargetTap();
            }}
          >
            <div
              className="w-full h-full rounded-full shadow-lg shadow-green-500/30 active:scale-90 transition-transform"
              style={{
                background: `radial-gradient(circle, ${REACTION_RUSH_CONFIG.targetColors.active} 0%, ${REACTION_RUSH_CONFIG.targetColors.active}90 60%, transparent 100%)`,
                boxShadow: `0 0 30px ${REACTION_RUSH_CONFIG.targetColors.active}60`,
              }}
            />
          </div>
        )}

        {/* Hit feedback */}
        {showFeedback === 'hit' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="text-6xl font-display text-green-400 animate-bounce">
              ✓
            </div>
          </div>
        )}

        {/* False start feedback */}
        {showFeedback === 'false' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="text-center">
              <div className="text-6xl font-display text-orange-400 animate-bounce">
                ✗
              </div>
              <p className="text-body text-orange-300 mt-2">False Start!</p>
            </div>
          </div>
        )}

        {/* Progress dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {Array.from({ length: REACTION_RUSH_CONFIG.totalRounds }).map((_, i) => {
            const round = rounds[i];
            let color = 'bg-surface-elevated';
            if (round) {
              if (round.isFalseStart) color = 'bg-orange-500';
              else if (round.reactionTimeMs !== null) color = 'bg-green-500';
              else color = 'bg-surface-elevated';
            }
            return (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${color} transition-colors`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
