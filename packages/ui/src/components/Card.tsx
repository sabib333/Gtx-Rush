import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  glow?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  children,
  className = '',
  interactive = false,
  onClick,
  padding = 'md',
  glow = false,
}: CardProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={`
        rounded-2xl bg-surface-raised border transition-all duration-normal ease-out-expo
        ${glow ? 'border-accent-500/30 shadow-glow' : 'border-surface-border'}
        ${interactive || onClick ? 'cursor-pointer active:scale-[0.98] hover:border-accent-500/30 hover:shadow-card-hover' : ''}
        ${paddingClasses[padding]}
        ${className}
      `}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {children}
    </Component>
  );
}
