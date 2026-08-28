import React from 'react';

interface StreakProps {
  currentStreak: number;
  longestStreak: number;
  weekDays?: boolean[]; // Mon-Sun, true = played
  className?: string;
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Streak({
  currentStreak,
  longestStreak,
  weekDays,
  className = '',
}: StreakProps) {
  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">🔥</span>
        <div>
          <div className="text-score-sm font-score text-white tabular-nums">
            {currentStreak} Day Streak
          </div>
          <div className="text-caption text-txt-secondary">
            Best: {longestStreak} days
          </div>
        </div>
      </div>

      {weekDays && (
        <div className="flex justify-between gap-1">
          {dayLabels.map((day, i) => (
            <div key={day} className="flex flex-col items-center gap-1.5">
              <div
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center text-caption-xs font-semibold
                  ${weekDays[i]
                    ? 'bg-success-500/20 text-success-400 border border-success-500/30'
                    : 'bg-surface-overlay text-txt-tertiary border border-transparent'
                  }
                `}
              >
                {weekDays[i] ? '✓' : '·'}
              </div>
              <span className="text-caption-xs text-txt-tertiary">{day}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-caption-xs text-txt-tertiary mt-3 text-center">
        Play at least 1 game daily to maintain your streak
      </p>
    </div>
  );
}
