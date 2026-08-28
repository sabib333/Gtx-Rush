import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-brand text-white shadow-glow-sm hover:shadow-glow active:shadow-none',
  secondary: 'bg-surface-raised text-txt-primary border border-surface-border hover:border-accent-500/30',
  ghost: 'bg-transparent text-txt-secondary hover:text-txt-primary hover:bg-surface-hover',
  danger: 'bg-danger-500 text-white shadow-glow-red',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-btn-sm rounded-lg gap-1.5',
  md: 'px-6 py-3 text-btn rounded-xl gap-2',
  lg: 'px-8 py-3.5 text-btn-lg rounded-xl gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-semibold
        transition-all duration-fast ease-out-expo
        active:scale-[0.97]
        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
}
