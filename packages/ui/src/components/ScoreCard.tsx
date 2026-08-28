import React from 'react';

interface ScoreCardProps {
  score: number;
  label?: string;
  isPersonalBest?: boolean;
  rank?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: { score: 'text-score-sm', label: 'text-caption', gap: 'gap-1' },
  md: { score: 'text-score', label: 'text-body-sm', gap: 'gap-1.5' },
  lg: { score: 'text-score-lg', label: 'text-body', gap: 'gap-2' },
};

export function ScoreCard({
  score,
  label = 'Score',
  isPersonalBest = false,
  rank,
  size = 'md',
  className = '',
}: ScoreCardProps) {
  const config = sizeConfig[size];

  return (
    <div className={`text-center ${className}`}>
      <div className={`${config.label} text-txt-secondary mb-1`}>{label}</div>
      <div className={`${config.score} font-score text-white tabular-nums animate-score-count`}>
        {score.toLocaleString()}
      </div>
      <div className={`flex items-center justify-center ${config.gap} mt-2`}>
        {isPersonalBest && (
          <span className="px-2.5 py-0.5 bg-warning-500/15 text-warning-400 text-caption-xs rounded-pill font-semibold animate-pop">
            🏆 Best
          </span>
        )}
        {rank != null && rank > 0 && (
          <span className="px-2.5 py-0.5 bg-accent-500/15 text-accent-400 text-caption-xs rounded-pill font-semibold">
            #{rank.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
