import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
}: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 rounded-lg',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
    card: 'h-24 rounded-2xl',
  };

  return (
    <div
      className={`shimmer ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
    />
  );
}

/* ============================================================
   Preset Skeleton Layouts
   ============================================================ */

export function SkeletonLeaderboard() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-raised">
          <Skeleton variant="text" width="1.75rem" height="1.75rem" className="rounded-lg" />
          <Skeleton variant="circular" width="2rem" height="2rem" />
          <div className="flex-1 space-y-1.5">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="30%" className="h-3" />
          </div>
          <Skeleton variant="text" width="4rem" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGameCard() {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="rectangular" width="4rem" height="4rem" className="rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="text" width="80%" className="h-3" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3">
        <Skeleton variant="circular" width="5rem" height="5rem" />
        <Skeleton variant="text" width="8rem" />
        <Skeleton variant="text" width="5rem" className="h-3" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
    </div>
  );
}
