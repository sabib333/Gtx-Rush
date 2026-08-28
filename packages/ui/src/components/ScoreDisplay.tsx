import React from 'react';

interface ScoreDisplayProps {
  score: number;
  label?: string;
  isPersonalBest?: boolean;
  rank?: number | null;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-2xl',
  md: 'text-4xl',
  lg: 'text-6xl',
};

export function ScoreDisplay({
  score,
  label = 'Score',
  isPersonalBest = false,
  rank,
  size = 'md',
}: ScoreDisplayProps) {
  return (
    <div className="text-center">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className={`font-bold text-white ${sizeClasses[size]}`}>
        {score.toLocaleString()}
      </div>
      <div className="flex items-center justify-center gap-2 mt-2">
        {isPersonalBest && (
          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-medium">
            🏆 New Best!
          </span>
        )}
        {rank !== null && rank !== undefined && (
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium">
            Rank #{rank}
          </span>
        )}
      </div>
    </div>
  );
}
