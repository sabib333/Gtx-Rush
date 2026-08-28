import React from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  level?: number;
  showLevel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-xl',
};

const levelBadgeSizes = {
  sm: 'w-4 h-4 text-[8px] -bottom-0.5 -right-0.5',
  md: 'w-5 h-5 text-[9px] -bottom-0.5 -right-0.5',
  lg: 'w-6 h-6 text-[10px] -bottom-0.5 -right-0.5',
  xl: 'w-7 h-7 text-[11px] -bottom-0.5 -right-0.5',
};

export function Avatar({
  src,
  name,
  size = 'md',
  level,
  showLevel = false,
  className = '',
}: AvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover bg-surface-overlay`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full bg-gradient-brand flex items-center justify-center font-bold text-white`}
        >
          {initials || '?'}
        </div>
      )}
      {showLevel && level != null && (
        <span
          className={`absolute flex items-center justify-center bg-accent-500 text-white font-bold rounded-full border-2 border-surface-raised ${levelBadgeSizes[size]}`}
        >
          {level}
        </span>
      )}
    </div>
  );
}
