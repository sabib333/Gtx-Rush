import React from 'react';

interface ShareCardProps {
  type: 'score' | 'challenge_win' | 'challenge_lose' | 'achievement' | 'rank_milestone';
  score?: number;
  gameName?: string;
  opponentName?: string;
  opponentScore?: number;
  achievementName?: string;
  rank?: number;
  className?: string;
}

export function ShareCard({
  type,
  score,
  gameName,
  opponentName,
  opponentScore,
  achievementName,
  rank,
  className = '',
}: ShareCardProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl p-6
        bg-gradient-to-br from-surface-raised via-surface-overlay to-surface-base
        border border-surface-border
        ${className}
      `}
    >
      {/* Brand watermark */}
      <div className="absolute top-3 right-3 text-caption-xs font-bold text-accent-500/40 uppercase tracking-widest">
        GTX Rush
      </div>

      {/* Content based on type */}
      <div className="text-center">
        {type === 'score' && score != null && (
          <>
            <div className="text-3xl mb-3">⚡</div>
            <div className="text-body-sm text-txt-secondary mb-1">I scored</div>
            <div className="text-score-xl font-score text-white tabular-nums mb-2">
              {score.toLocaleString()}
            </div>
            {gameName && (
              <div className="text-caption text-txt-tertiary mb-3">{gameName}</div>
            )}
          </>
        )}

        {type === 'challenge_win' && score != null && (
          <>
            <div className="text-3xl mb-3">🏆</div>
            <div className="text-h2 font-display text-white mb-3">I won!</div>
            <div className="text-score-lg font-score text-white tabular-nums mb-1">
              {score.toLocaleString()}
            </div>
            {opponentName && opponentScore != null && (
              <div className="text-body-sm text-txt-secondary">
                vs {opponentName}: {opponentScore.toLocaleString()}
              </div>
            )}
          </>
        )}

        {type === 'challenge_lose' && score != null && (
          <>
            <div className="text-3xl mb-3">⚔️</div>
            <div className="text-body-sm text-txt-secondary mb-1">Challenge</div>
            <div className="text-score font-score text-white tabular-nums mb-1">
              {score.toLocaleString()}
            </div>
            {opponentName && (
              <div className="text-body-sm text-txt-secondary">
                Can you beat {opponentName}?
              </div>
            )}
          </>
        )}

        {type === 'achievement' && achievementName && (
          <>
            <div className="text-3xl mb-3">🏅</div>
            <div className="text-body-sm text-txt-secondary mb-1">Unlocked</div>
            <div className="text-h2 font-display text-white">{achievementName}</div>
          </>
        )}

        {type === 'rank_milestone' && rank != null && (
          <>
            <div className="text-3xl mb-3">🎯</div>
            <div className="text-body-sm text-txt-secondary mb-1">I reached</div>
            <div className="text-score-lg font-score text-accent-400 tabular-nums mb-2">
              #{rank.toLocaleString()}
            </div>
            <div className="text-body-sm text-txt-secondary">Global Rank</div>
          </>
        )}

        {/* Tagline */}
        <div className="mt-4 pt-3 border-t border-surface-border/50">
          <span className="text-caption text-txt-tertiary italic">
            Play. Compete. Rise. ⚡
          </span>
        </div>
      </div>
    </div>
  );
}
