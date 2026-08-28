import React from 'react';
import { RankRow } from './RankRow';
import { EmptyState } from './EmptyState';
import { SkeletonLeaderboard } from './Skeleton';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  score: number;
  level?: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  loading?: boolean;
  emptyMessage?: string;
  onEntryClick?: (userId: string) => void;
  className?: string;
}

export function Leaderboard({
  entries,
  currentUserId,
  loading = false,
  emptyMessage = 'No entries yet',
  onEntryClick,
  className = '',
}: LeaderboardProps) {
  if (loading) {
    return <SkeletonLeaderboard />;
  }

  if (entries.length === 0) {
    return <EmptyState icon="🏆" title={emptyMessage} />;
  }

  // Find current user in the list
  const currentUserEntry = entries.find((e) => e.userId === currentUserId);

  return (
    <div className={`space-y-1 ${className}`}>
      {entries.map((entry) => (
        <RankRow
          key={entry.userId}
          rank={entry.rank}
          displayName={entry.displayName}
          avatarUrl={entry.avatarUrl}
          score={entry.score}
          level={entry.level}
          isCurrentUser={entry.userId === currentUserId}
          onClick={onEntryClick ? () => onEntryClick(entry.userId) : undefined}
        />
      ))}

      {/* Show user rank at bottom if not in top entries */}
      {currentUserId && !currentUserEntry && (
        <div className="mt-4 pt-3 border-t border-surface-border">
          <RankRow
            rank={0}
            displayName="You"
            score={0}
            isCurrentUser
          />
        </div>
      )}
    </div>
  );
}
