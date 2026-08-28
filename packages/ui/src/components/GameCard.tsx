import React from 'react';
import { Badge } from './Badge';

interface GameCardProps {
  slug: string;
  name: string;
  icon: string;
  description: string;
  color: 'reaction' | 'tap' | 'quiz';
  bestScore?: number;
  globalRank?: number;
  isPopular?: boolean;
  onClick?: () => void;
  className?: string;
}

const colorMap = {
  reaction: { bg: 'bg-game-reaction/15', text: 'text-game-reaction', glow: 'shadow-glow-red' },
  tap: { bg: 'bg-game-tap/15', text: 'text-game-tap', glow: 'shadow-glow-green' },
  quiz: { bg: 'bg-game-quiz/15', text: 'text-game-quiz', glow: 'shadow-glow-purple' },
};

export function GameCard({
  slug,
  name,
  icon,
  description,
  color,
  bestScore,
  globalRank,
  isPopular,
  onClick,
  className = '',
}: GameCardProps) {
  const colors = colorMap[color];

  return (
    <button
      onClick={onClick}
      className={`
        w-full card-interactive p-4 text-left
        hover:${colors.glow}
        ${className}
      `}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center text-2xl flex-shrink-0`}>
          {icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-body font-bold text-txt-primary truncate">{name}</h3>
            {isPopular && <Badge variant="warning" size="sm">🔥 Hot</Badge>}
          </div>
          <p className="text-caption text-txt-secondary mt-0.5 line-clamp-1">{description}</p>
          {(bestScore != null || globalRank != null) && (
            <div className="flex items-center gap-3 mt-1.5">
              {bestScore != null && (
                <span className="text-caption-xs text-txt-tertiary">
                  Best: <span className="text-txt-secondary font-semibold tabular-nums">{bestScore.toLocaleString()}</span>
                </span>
              )}
              {globalRank != null && (
                <span className="text-caption-xs text-txt-tertiary">
                  Rank: <span className="text-accent-400 font-semibold tabular-nums">#{globalRank.toLocaleString()}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Arrow */}
        <span className="text-txt-tertiary text-lg flex-shrink-0">→</span>
      </div>
    </button>
  );
}
