import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  color?: 'accent' | 'success' | 'warning' | 'danger' | 'energy';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  className?: string;
}

const colorClasses = {
  accent: 'bg-accent-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  energy: 'bg-energy-500',
};

const trackSizes = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3.5',
};

export function ProgressBar({
  value,
  max = 100,
  color = 'accent',
  size = 'md',
  showLabel = false,
  label,
  animated = true,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-caption text-txt-secondary">{label}</span>
          <span className="text-caption text-txt-secondary tabular-nums">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div className={`w-full ${trackSizes[size]} bg-surface-overlay rounded-pill overflow-hidden`}>
        <div
          className={`h-full rounded-pill ${colorClasses[color]} ${animated ? 'transition-all duration-slow ease-out-expo' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   XPBar — Specific XP progress bar with level markers
   ============================================================ */

interface XPBarProps {
  currentXP: number;
  nextLevelXP: number;
  level: number;
  className?: string;
}

export function XPBar({ currentXP, nextLevelXP, level, className = '' }: XPBarProps) {
  const percentage = nextLevelXP > 0 ? (currentXP / nextLevelXP) * 100 : 0;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-caption text-txt-secondary">
          Level {level}
        </span>
        <span className="text-caption text-accent-400 tabular-nums font-semibold">
          {currentXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP
        </span>
      </div>
      <div className="w-full h-2.5 bg-surface-overlay rounded-pill overflow-hidden">
        <div
          className="h-full rounded-pill bg-gradient-brand transition-all duration-slow ease-out-expo"
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
}
