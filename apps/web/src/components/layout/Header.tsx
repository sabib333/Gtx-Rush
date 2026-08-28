import { Avatar, IconButton } from '@gtx-rush/ui';

interface HeaderProps {
  displayName?: string;
  level?: number;
  avatarUrl?: string | null;
  notificationCount?: number;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
}

export function Header({
  displayName = 'Player',
  level = 1,
  avatarUrl,
  notificationCount = 0,
  onNotificationClick,
  onProfileClick,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-surface-base/90 backdrop-blur-xl border-b border-surface-border/50">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-display font-black text-white">
            GTX <span className="text-accent-400">Rush</span>
          </span>
          <span className="text-sm">⚡</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {onNotificationClick && (
            <IconButton
              icon={<span className="text-lg">🔔</span>}
              size="sm"
              variant="ghost"
              badge={notificationCount}
              onClick={onNotificationClick}
            />
          )}
          {onProfileClick && (
            <button
              onClick={onProfileClick}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl
                       hover:bg-surface-hover transition-colors duration-fast"
            >
              <Avatar src={avatarUrl} name={displayName} size="sm" showLevel level={level} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
