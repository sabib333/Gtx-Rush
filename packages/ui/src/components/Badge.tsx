import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'energy';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-overlay text-txt-secondary',
  success: 'bg-success-500/15 text-success-400',
  warning: 'bg-warning-500/15 text-warning-400',
  danger: 'bg-danger-500/15 text-danger-400',
  accent: 'bg-accent-500/15 text-accent-400',
  energy: 'bg-energy-500/15 text-energy-400',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-caption-xs',
  md: 'px-2.5 py-1 text-caption',
};

const dotColorClasses: Record<BadgeVariant, string> = {
  default: 'bg-txt-tertiary',
  success: 'bg-success-400',
  warning: 'bg-warning-400',
  danger: 'bg-danger-400',
  accent: 'bg-accent-400',
  energy: 'bg-energy-400',
};

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-semibold rounded-pill
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColorClasses[variant]}`} />
      )}
      {children}
    </span>
  );
}
