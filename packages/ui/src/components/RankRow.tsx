import React from 'react';
import { Avatar } from './Avatar';

interface RankRowProps {
  rank: number;
  displayName: string;
  avatarUrl?: string | null;
  score: number;
  level?: number;
  isCurrentUser?: boolean;
  onClick?: () => void;
  className?: string;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;

  return (
    <span className="w-7 h-7 flex items-center justify-center text-caption font-bold text-txt-secondary tabular-nums">
      {rank}
    </span>
  );
}

export function RankRow({
  rank,
  displayName,
  avatarUrl,
  score,
  level,
  isCurrentUser = false,
  onClick,
  className = '',
}: RankRowProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-fast
        ${isCurrentUser
          ? 'bg-accent-500/10 border border-accent-500/20'
          : 'hover:bg-surface-hover'
        }
        ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''}
        ${className}
      `}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <RankBadge rank={rank} />
      <Avatar src={avatarUrl} name={displayName} size="sm" />
      <div className="flex-1 min-w-0 text-left">
        <div className={`text-body-sm font-semibold truncate ${isCurrentUser ? 'text-accent-400' : 'text-txt-primary'}`}>
          {isCurrentUser ? 'You' : displayName}
        </div>
        {level != null && (
          <div className="text-caption-xs text-txt-tertiary">Lv. {level}</div>
        )}
      </div>
      <div className="text-score-sm font-score text-white tabular-nums">
        {score.toLocaleString()}
      </div>
    </Component>
  );
}
