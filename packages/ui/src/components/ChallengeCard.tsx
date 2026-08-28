import React from 'react';
import { Avatar } from './Avatar';
import { Button } from './Button';

interface ChallengeCardProps {
  type: 'daily' | 'friend';
  title: string;
  gameName: string;
  gameIcon: string;
  timer?: string;
  attempts?: { used: number; total: number };
  opponentName?: string;
  opponentScore?: number;
  status: 'active' | 'pending' | 'completed';
  reward?: string;
  onPlay?: () => void;
  className?: string;
}

export function ChallengeCard({
  type,
  title,
  gameName,
  gameIcon,
  timer,
  attempts,
  opponentName,
  opponentScore,
  status,
  reward,
  onPlay,
  className = '',
}: ChallengeCardProps) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      {/* Header gradient */}
      <div className={`px-4 py-3 ${type === 'daily' ? 'bg-gradient-challenge' : 'bg-gradient-brand'}`}>
        <div className="flex items-center justify-between">
          <span className="text-caption-xs font-bold text-white/90 uppercase tracking-wider">
            {type === 'daily' ? '🔥 Daily Rush' : '⚡ Challenge'}
          </span>
          {timer && (
            <span className="text-caption-xs font-mono text-white/80 tabular-nums">{timer}</span>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Game info */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{gameIcon}</span>
          <div>
            <h3 className="text-body font-bold text-white">{title}</h3>
            <p className="text-caption text-txt-secondary">{gameName}</p>
          </div>
        </div>

        {/* Opponent (friend challenge) */}
        {opponentName && opponentScore != null && (
          <div className="flex items-center gap-3 mb-3 p-2.5 bg-surface-overlay rounded-xl">
            <Avatar name={opponentName} size="sm" />
            <div className="flex-1">
              <span className="text-caption text-txt-secondary">{opponentName}</span>
            </div>
            <span className="text-score-sm font-score text-white tabular-nums">
              {opponentScore.toLocaleString()}
            </span>
          </div>
        )}

        {/* Attempts */}
        {attempts && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-caption text-txt-tertiary">Attempts:</span>
            <div className="flex gap-1">
              {Array.from({ length: attempts.total }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < attempts.used ? 'bg-accent-500' : 'bg-surface-overlay'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Reward */}
        {reward && (
          <div className="text-caption text-energy-400 mb-3">{reward}</div>
        )}

        {/* Action */}
        {status === 'active' && onPlay && (
          <Button variant="primary" fullWidth size="sm" onClick={onPlay}>
            {type === 'daily' ? '⚡ Play Now' : '⚔️ Accept Challenge'}
          </Button>
        )}
        {status === 'completed' && (
          <div className="text-center text-caption text-txt-tertiary">Completed</div>
        )}
        {status === 'pending' && (
          <div className="text-center text-caption text-warning-400">Waiting for opponent</div>
        )}
      </div>
    </div>
  );
}
