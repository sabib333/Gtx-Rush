import React from 'react';
import { IconButton } from './IconButton';

interface GameHeaderProps {
  title: string;
  score?: number;
  timeLeft?: number; // seconds
  round?: number;
  totalRounds?: number;
  onPause?: () => void;
  onExit?: () => void;
  showPause?: boolean;
  className?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function GameHeader({
  title,
  score,
  timeLeft,
  round,
  totalRounds,
  onPause,
  onExit,
  showPause = true,
  className = '',
}: GameHeaderProps) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${className}`}>
      {/* Exit button */}
      <IconButton
        icon={<span className="text-lg">✕</span>}
        size="sm"
        variant="ghost"
        onClick={onExit}
      />

      {/* Center: title + round */}
      <div className="text-center">
        <div className="text-caption font-bold text-txt-secondary uppercase tracking-wider">{title}</div>
        {round != null && totalRounds != null && (
          <div className="text-caption-xs text-txt-tertiary tabular-nums">
            Round {round}/{totalRounds}
          </div>
        )}
      </div>

      {/* Score */}
      <div className="flex items-center gap-2">
        {timeLeft != null && (
          <span className={`text-body font-bold font-mono tabular-nums ${
            timeLeft <= 10 ? 'text-danger-400' : 'text-txt-primary'
          }`}>
            {formatTime(timeLeft)}
          </span>
        )}
        {score != null && (
          <span className="text-score-sm font-score text-white tabular-nums ml-2">
            {score.toLocaleString()}
          </span>
        )}
        {showPause && onPause && (
          <IconButton
            icon={<span className="text-lg">⏸</span>}
            size="sm"
            variant="ghost"
            onClick={onPause}
          />
        )}
      </div>
    </div>
  );
}
