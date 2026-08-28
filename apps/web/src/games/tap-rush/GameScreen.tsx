/**
 * Tap Rush — Game Screen
 *
 * The core gameplay screen. Handles:
 * - Target spawning at safe positions
 * - Tap detection with generous mobile hit areas
 * - Combo tracking with multiplier
 * - Bonus target spawning
 * - Monotonic timer for accurate countdown
 * - Invalid tap handling
 * - Game state machine (active → time_up)
 *
 * Gameplay loop:
 * 1. Target appears
 * 2. Player taps target (valid) → score, combo++
 * 3. Player taps outside (invalid) → penalty, combo break
 * 4. New target spawns
 * 5. Timer reaches 0 → game complete
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { GameHeader } from '@gtx-rush/ui';
import type {
  Target,
  InputEvent,
  GameSession,
  GameState,
  GameMode,
  GameResult,
  TargetType,
} from './types';
import {
  TAP_RUSH_CONFIG,
  calculateComboMultiplier,
  calculateTapScore,
  generateTargetPosition,
  isTapOnTarget,
  getNextSpawnDelay,
  shouldSpawnBonusTarget,
} from './config';

interface GameScreenProps {
  session: GameSession;
  gameMode: GameMode;
  onGameComplete: (result: GameResult, events: InputEvent[]) => void;
  onExit: () => void;
}

// ── Target ID generator ──────────────────────────────────────────────
let targetIdCounter = 0;
function generateTargetId(): string {
  targetIdCounter++;
  return `target_${targetIdCounter}_${Date.now()}`;
}

export function GameScreen({ session, gameMode, onGameComplete, onExit }: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>('active');
  const [targets, setTargets] = useState<Target[]>([]);
  const [activeTarget, setActiveTarget] = useState<Target | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [highestCombo, setHighestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TAP_RUSH_CONFIG.durationMs / 1000);
  const [showFeedback, setShowFeedback] = useState<'hit' | 'invalid' | 'bonus' | null>(null);
  const [comboPopup, setComboPopup] = useState<number | null>(null);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);
  const lastTargetPositionRef = useRef<{ x: number; y: number } | undefined>(undefined);
  const eventsRef = useRef<InputEvent[]>([]);
  const targetsRef = useRef<Target[]>([]);
  const activeTargetRef = useRef<Target | null>(null);
  const comboRef = useRef(0);
  const scoreRef = useRef(0);
  const highestComboRef = useRef(0);
  const spawnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboPopupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCompleteRef = useRef(false);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (spawnTimeoutRef.current) clearTimeout(spawnTimeoutRef.current);
      if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (comboPopupTimeoutRef.current) clearTimeout(comboPopupTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Complete the game ────────────────────────────────────────────────
  const completeGame = useCallback(() => {
    if (isCompleteRef.current) return;
    isCompleteRef.current = true;

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current);

    // Clear all pending timeouts
    if (spawnTimeoutRef.current) clearTimeout(spawnTimeoutRef.current);
    if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);

    setGameState('time_up');

    // Record session finished event
    const endEvent: InputEvent = {
      type: 'session_finished',
      timestamp: performance.now(),
    };
    eventsRef.current.push(endEvent);

    // Build result
    const endedAt = performance.now();
    const durationMs = endedAt - startTimeRef.current;

    let validTaps = 0;
    let invalidTaps = 0;
    let bonusTaps = 0;
    let currentCombo = 0;
    let bestCombo = 0;
    let baseScore = 0;
    let comboBonus = 0;
    let bonusTargetScore = 0;
    let invalidTapPenalty = 0;
    let totalScore = 0;

    for (const event of eventsRef.current) {
      if (event.type === 'target_hit') {
        validTaps++;
        currentCombo++;

        const target = targetsRef.current.find((t) => t.id === event.targetId);
        const targetType = (target?.type ?? event.targetType) ?? 'normal';

        const { points } = calculateTapScore(targetType, currentCombo);
        const basePoints =
          targetType === 'bonus'
            ? TAP_RUSH_CONFIG.bonusTargetPoints
            : TAP_RUSH_CONFIG.normalTargetPoints;

        if (targetType === 'bonus') {
          bonusTaps++;
          bonusTargetScore += basePoints;
        } else {
          baseScore += basePoints;
        }
        comboBonus += points - basePoints;
        totalScore += points;
        bestCombo = Math.max(bestCombo, currentCombo);
      } else if (event.type === 'invalid_tap') {
        invalidTaps++;
        const penalty = TAP_RUSH_CONFIG.invalidTapPenalty;
        invalidTapPenalty += penalty;
        totalScore = Math.max(0, totalScore - penalty);

        if (TAP_RUSH_CONFIG.comboResetOnInvalid) {
          currentCombo = 0;
        } else {
          currentCombo = Math.max(0, currentCombo - TAP_RUSH_CONFIG.comboBreakReduction);
        }
      }
    }

    const totalTaps = validTaps + invalidTaps;
    const accuracy = totalTaps > 0 ? Math.round((validTaps / totalTaps) * 100) : 0;
    const tapsPerSecond = durationMs > 0 ? Math.round((totalTaps / (durationMs / 1000)) * 10) / 10 : 0;

    const result: GameResult = {
      score: totalScore,
      validTaps,
      invalidTaps,
      accuracy,
      highestCombo: bestCombo,
      tapsPerSecond,
      bonusTaps,
      breakdown: {
        baseScore,
        comboBonus,
        bonusTargetScore,
        invalidTapPenalty,
      },
      metadata: {
        averageCombo: validTaps > 0 ? Math.round((validTaps / Math.max(1, validTaps)) * 10) / 10 : 0,
        totalTaps,
      },
      events: eventsRef.current,
      durationMs,
    };

    onGameComplete(result, eventsRef.current);
  }, [onGameComplete]);

  // ── Spawn a new target ───────────────────────────────────────────────
  const spawnTarget = useCallback(() => {
    if (isCompleteRef.current || !gameAreaRef.current) return;

    const rect = gameAreaRef.current.getBoundingClientRect();
    const targetType: TargetType = shouldSpawnBonusTarget() ? 'bonus' : 'normal';
    const position = generateTargetPosition(
      rect.width,
      rect.height,
      TAP_RUSH_CONFIG.targetSizePx,
      lastTargetPositionRef.current,
    );

    const target: Target = {
      id: generateTargetId(),
      type: targetType,
      x: position.x,
      y: position.y,
      size: TAP_RUSH_CONFIG.targetSizePx,
      spawnTimestamp: performance.now(),
      state: 'active',
    };

    lastTargetPositionRef.current = position;

    // Update refs
    targetsRef.current = [...targetsRef.current, target];
    activeTargetRef.current = target;

    // Update state
    setTargets([...targetsRef.current]);
    setActiveTarget(target);

    // Record spawn event
    const spawnEvent: InputEvent = {
      type: 'target_spawned',
      timestamp: performance.now(),
      targetId: target.id,
      targetType: target.type,
      targetPosition: { x: target.x, y: target.y },
    };
    eventsRef.current.push(spawnEvent);

    // Auto-expire target after lifetime
    if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);
    expireTimeoutRef.current = setTimeout(() => {
      if (activeTargetRef.current?.id === target.id && target.state === 'active') {
        // Target expired
        target.state = 'expired';
        activeTargetRef.current = null;

        eventsRef.current.push({
          type: 'target_missed',
          timestamp: performance.now(),
          targetId: target.id,
          targetType: target.type,
          targetPosition: { x: target.x, y: target.y },
        });

        setTargets([...targetsRef.current]);
        setActiveTarget(null);

        // Spawn next target
        spawnTimeoutRef.current = setTimeout(spawnTarget, getNextSpawnDelay());
      }
    }, TAP_RUSH_CONFIG.targetLifetimeMs);
  }, []);

  // ── Handle valid tap on target ───────────────────────────────────────
  const handleTargetTap = useCallback(
    (tapX: number, tapY: number) => {
      const target = activeTargetRef.current;
      if (!target || target.state !== 'active') return;

      if (isTapOnTarget(tapX, tapY, target.x, target.y, target.size)) {
        // Valid tap!
        if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);

        target.state = 'hit';
        comboRef.current++;
        const newCombo = comboRef.current;
        highestComboRef.current = Math.max(highestComboRef.current, newCombo);

        const { points, multiplier } = calculateTapScore(target.type, newCombo);
        scoreRef.current += points;

        // Record hit event
        const hitEvent: InputEvent = {
          type: 'target_hit',
          timestamp: performance.now(),
          targetId: target.id,
          targetType: target.type,
          targetPosition: { x: target.x, y: target.y },
          tapPosition: { x: tapX, y: tapY },
          combo: newCombo,
        };
        eventsRef.current.push(hitEvent);

        // Update state
        setScore(scoreRef.current);
        setCombo(newCombo);
        setHighestCombo(highestComboRef.current);
        activeTargetRef.current = null;
        setActiveTarget(null);
        setTargets([...targetsRef.current]);

        // Show feedback
        if (target.type === 'bonus') {
          setShowFeedback('bonus');
        } else {
          setShowFeedback('hit');
        }
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = setTimeout(() => setShowFeedback(null), 300);

        // Show combo popup at milestones
        if (newCombo > 0 && newCombo % 5 === 0) {
          setComboPopup(newCombo);
          if (comboPopupTimeoutRef.current) clearTimeout(comboPopupTimeoutRef.current);
          comboPopupTimeoutRef.current = setTimeout(() => setComboPopup(null), 800);
        }

        // Spawn next target
        spawnTimeoutRef.current = setTimeout(spawnTarget, getNextSpawnDelay());
      }
    },
    [spawnTarget],
  );

  // ── Handle tap on game area (invalid tap if not on target) ───────────
  const handleGameAreaTap = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (gameState !== 'active') return;

      let clientX: number;
      let clientY: number;

      if ('touches' in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0]!.clientX;
        clientY = e.touches[0]!.clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const target = activeTargetRef.current;
      if (target && target.state === 'active') {
        if (isTapOnTarget(clientX, clientY, target.x, target.y, target.size)) {
          handleTargetTap(clientX, clientY);
          return;
        }
      }

      // Invalid tap — tapped outside the target
      if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);

      const invalidEvent: InputEvent = {
        type: 'invalid_tap',
        timestamp: performance.now(),
        tapPosition: { x: clientX, y: clientY },
        combo: comboRef.current,
      };
      eventsRef.current.push(invalidEvent);

      // Apply combo penalty
      if (TAP_RUSH_CONFIG.comboResetOnInvalid) {
        comboRef.current = 0;
      } else {
        comboRef.current = Math.max(0, comboRef.current - TAP_RUSH_CONFIG.comboBreakReduction);
      }

      // Apply score penalty
      scoreRef.current = Math.max(0, scoreRef.current - TAP_RUSH_CONFIG.invalidTapPenalty);

      setCombo(comboRef.current);
      setScore(scoreRef.current);

      // Show invalid feedback
      setShowFeedback('invalid');
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => setShowFeedback(null), 300);
    },
    [gameState, handleTargetTap],
  );

  // ── Start the game ───────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'active') return;

    startTimeRef.current = performance.now();
    isCompleteRef.current = false;

    // Record session start
    eventsRef.current.push({
      type: 'session_started',
      timestamp: startTimeRef.current,
    });

    // Start the timer
    let secondsLeft = TAP_RUSH_CONFIG.durationMs / 1000;
    setTimeLeft(secondsLeft);

    timerRef.current = setInterval(() => {
      secondsLeft--;
      setTimeLeft(secondsLeft);

      if (secondsLeft <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        completeGame();
      }
    }, 1000);

    // Spawn first target after a short delay
    spawnTimeoutRef.current = setTimeout(spawnTarget, 200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (spawnTimeoutRef.current) clearTimeout(spawnTimeoutRef.current);
    };
  }, [gameState, completeGame, spawnTarget]);

  return (
    <div className="min-h-dvh bg-surface-base flex flex-col">
      {/* Header */}
      <GameHeader
        title="Tap Rush"
        score={score}
        timeLeft={timeLeft}
        onPause={() => {}}
        onExit={onExit}
        showPause={false}
      />

      {/* Combo indicator */}
      {combo >= TAP_RUSH_CONFIG.comboThreshold && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-amber-500/20 border border-amber-500/40 rounded-full px-3 py-1 animate-pulse">
            <span className="text-caption font-bold text-amber-400 tabular-nums">
              {combo}× COMBO
            </span>
            <span className="text-caption-xs text-amber-300 ml-1">
              ×{calculateComboMultiplier(combo).toFixed(1)}
            </span>
          </div>
        </div>
      )}

      {/* Combo popup */}
      {comboPopup !== null && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="text-display-lg font-display text-amber-400 animate-bounce">
            {comboPopup}× 🔥
          </div>
        </div>
      )}

      {/* Game Area */}
      <div
        ref={gameAreaRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ background: TAP_RUSH_CONFIG.backgroundColor, touchAction: 'none' }}
        onTouchStart={handleGameAreaTap}
        onClick={handleGameAreaTap}
      >
        {/* Active Target */}
        {activeTarget && activeTarget.state === 'active' && (
          <div
            className="absolute cursor-pointer z-20"
            style={{
              left: activeTarget.x,
              top: activeTarget.y,
              width: activeTarget.size,
              height: activeTarget.size,
            }}
          >
            <div
              className="w-full h-full rounded-full active:scale-90 transition-transform duration-75"
              style={{
                background:
                  activeTarget.type === 'bonus'
                    ? `radial-gradient(circle, ${TAP_RUSH_CONFIG.targetColors.bonus} 0%, ${TAP_RUSH_CONFIG.targetColors.bonus}90 60%, transparent 100%)`
                    : `radial-gradient(circle, ${TAP_RUSH_CONFIG.targetColors.normal} 0%, ${TAP_RUSH_CONFIG.targetColors.normal}90 60%, transparent 100%)`,
                boxShadow:
                  activeTarget.type === 'bonus'
                    ? `0 0 30px ${TAP_RUSH_CONFIG.targetColors.bonus}60, 0 0 60px ${TAP_RUSH_CONFIG.targetColors.bonus}30`
                    : `0 0 30px ${TAP_RUSH_CONFIG.targetColors.normal}60`,
              }}
            />
            {activeTarget.type === 'bonus' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-white drop-shadow-lg">+5</span>
              </div>
            )}
          </div>
        )}

        {/* Hit feedback */}
        {showFeedback === 'hit' && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="text-5xl font-display text-green-400 animate-bounce">+100</div>
          </div>
        )}

        {/* Bonus hit feedback */}
        {showFeedback === 'bonus' && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="text-5xl font-display text-amber-400 animate-bounce">+500 ✨</div>
          </div>
        )}

        {/* Invalid tap feedback */}
        {showFeedback === 'invalid' && (
          <div className="fixed inset--0 flex items-center justify-center pointer-events-none z-30">
            <div className="text-4xl font-display text-red-400 animate-bounce">-{TAP_RUSH_CONFIG.invalidTapPenalty}</div>
          </div>
        )}

        {/* Instructions */}
        {targets.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-pulse">👆</div>
              <p className="text-body text-txt-tertiary">Tap the targets!</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom stats bar */}
      <div className="flex items-center justify-around px-4 py-2 bg-surface-raised">
        <div className="text-center">
          <div className="text-caption-xs text-txt-tertiary">Taps</div>
          <div className="text-body font-bold text-white tabular-nums">
            {eventsRef.current.filter(
              (e) => e.type === 'target_hit' || e.type === 'invalid_tap'
            ).length}
          </div>
        </div>
        <div className="text-center">
          <div className="text-caption-xs text-txt-tertiary">Combo</div>
          <div
            className={`text-body font-bold tabular-nums ${
              combo >= TAP_RUSH_CONFIG.comboThreshold ? 'text-amber-400' : 'text-white'
            }`}
          >
            {combo}×
          </div>
        </div>
        <div className="text-center">
          <div className="text-caption-xs text-txt-tertiary">Best</div>
          <div className="text-body font-bold text-white tabular-nums">{highestCombo}×</div>
        </div>
      </div>
    </div>
  );
}
