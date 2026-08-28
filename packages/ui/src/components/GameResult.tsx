import React from 'react';
import { ScoreCard } from './ScoreCard';
import { Button } from './Button';
import { Badge } from './Badge';

interface GameResultProps {
  score: number;
  rank?: number | null;
  isPersonalBest?: boolean;
  xpAwarded?: number;
  levelUp?: boolean;
  newLevel?: number;
  breakdown?: Record<string, number>;
  gameName: string;
  onPlayAgain: () => void;
  onChallengeFriend?: () => void;
  onShare?: () => void;
  onBack?: () => void;
  className?: string;
}

export function GameResult({
  score,
  rank,
  isPersonalBest,
  xpAwarded,
  levelUp,
  newLevel,
  breakdown,
  gameName,
  onPlayAgain,
  onChallengeFriend,
  onShare,
  onBack,
  className = '',
}: GameResultProps) {
  return (
    <div className={`min-h-dvh bg-surface-base flex flex-col ${className}`}>
      {/* Header */}
      <div className="text-center pt-12 pb-6 animate-fade-in">
        <div className="text-4xl mb-2">
          {isPersonalBest ? '🔥' : rank != null && rank <= 100 ? '⚡' : '🎯'}
        </div>
        <h1 className="text-h1 font-display text-white">
          {isPersonalBest ? 'New Best!' : 'Great Run!'}
        </h1>
        <p className="text-body-sm text-txt-secondary mt-1">{gameName}</p>
      </div>

      {/* Score */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <ScoreCard
          score={score}
          label="Your Score"
          isPersonalBest={isPersonalBest}
          rank={rank}
          size="lg"
        />

        {/* XP Award */}
        {xpAwarded != null && xpAwarded > 0 && (
          <div className="mt-6 flex items-center gap-2 animate-slide-up">
            <Badge variant="energy" size="md">⚡ +{xpAwarded} XP</Badge>
            {levelUp && newLevel != null && (
              <Badge variant="warning" size="md">🎉 Level {newLevel}!</Badge>
            )}
          </div>
        )}

        {/* Breakdown */}
        {breakdown && Object.keys(breakdown).length > 0 && (
          <div className="mt-6 w-full max-w-xs">
            <div className="text-caption text-txt-tertiary text-center mb-2">Breakdown</div>
            <div className="space-y-1.5">
              {Object.entries(breakdown).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between px-3 py-1.5 bg-surface-raised rounded-lg">
                  <span className="text-caption text-txt-secondary capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-caption font-semibold text-white tabular-nums">
                    {value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 pb-8 space-y-3 animate-slide-up">
        <Button variant="primary" fullWidth size="lg" onClick={onPlayAgain}>
          ⚡ Play Again
        </Button>
        {onChallengeFriend && (
          <Button variant="secondary" fullWidth onClick={onChallengeFriend}>
            ⚔️ Challenge Friend
          </Button>
        )}
        {onShare && (
          <Button variant="ghost" fullWidth onClick={onShare}>
            📤 Share Score
          </Button>
        )}
        {onBack && (
          <Button variant="ghost" fullWidth onClick={onBack}>
            ← Back to Games
          </Button>
        )}
      </div>
    </div>
  );
}
