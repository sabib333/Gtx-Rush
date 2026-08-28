import React from 'react';
import { Button } from './Button';
import { ScoreCard } from './ScoreCard';

interface GameLaunchProps {
  gameName: string;
  gameIcon: string;
  gameColor: 'reaction' | 'tap' | 'quiz';
  description: string;
  bestScore?: number;
  globalRank?: number;
  onStart: () => void;
  onBack?: () => void;
  className?: string;
}

const colorMap = {
  reaction: 'bg-game-reaction/15 text-game-reaction',
  tap: 'bg-game-tap/15 text-game-tap',
  quiz: 'bg-game-quiz/15 text-game-quiz',
};

const glowMap = {
  reaction: 'shadow-glow-red',
  tap: 'shadow-glow-green',
  quiz: 'shadow-glow-purple',
};

export function GameLaunch({
  gameName,
  gameIcon,
  gameColor,
  description,
  bestScore,
  globalRank,
  onStart,
  onBack,
  className = '',
}: GameLaunchProps) {
  return (
    <div className={`min-h-dvh bg-surface-base flex flex-col items-center justify-center px-6 ${className}`}>
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-4 left-4 text-txt-secondary hover:text-white transition-colors"
        >
          ← Back
        </button>
      )}

      {/* Game icon */}
      <div className={`w-24 h-24 rounded-3xl ${colorMap[gameColor]} flex items-center justify-center text-5xl mb-6 ${glowMap[gameColor]} animate-bounce-in`}>
        {gameIcon}
      </div>

      {/* Title */}
      <h1 className="text-display font-display text-white text-center mb-2">{gameName}</h1>
      <p className="text-body-sm text-txt-secondary text-center mb-8">{description}</p>

      {/* Stats */}
      {(bestScore != null || globalRank != null) && (
        <div className="flex gap-6 mb-10">
          {bestScore != null && (
            <div className="text-center">
              <div className="text-caption text-txt-tertiary mb-1">Best</div>
              <div className="text-score font-score text-white tabular-nums">
                {bestScore.toLocaleString()}
              </div>
            </div>
          )}
          {globalRank != null && (
            <div className="text-center">
              <div className="text-caption text-txt-tertiary mb-1">Global</div>
              <div className="text-score font-score text-accent-400 tabular-nums">
                #{globalRank.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ready text */}
      <div className="text-body-sm text-txt-tertiary mb-6 animate-pulse">Ready?</div>

      {/* Start button */}
      <Button variant="primary" size="lg" onClick={onStart} className="min-w-[200px]">
        ▶ START
      </Button>
    </div>
  );
}
