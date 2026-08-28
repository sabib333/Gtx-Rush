import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'accent' | 'white';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-[1.5px]',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
};

export function LoadingSpinner({
  size = 'md',
  color = 'accent',
  className = '',
}: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full animate-spin
        ${color === 'accent'
          ? 'border-surface-border border-t-accent-500'
          : 'border-white/20 border-t-white'
        }`}
      />
    </div>
  );
}

/* ============================================================
   Full-screen loading state
   ============================================================ */

export function FullScreenLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-surface-base flex flex-col items-center justify-center gap-4 z-50">
      <LoadingSpinner size="lg" />
      <p className="text-body-sm text-txt-secondary">{message}</p>
    </div>
  );
}
