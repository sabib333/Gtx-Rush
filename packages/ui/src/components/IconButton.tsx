import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'surface' | 'accent';
  badge?: number;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const variantClasses = {
  ghost: 'text-txt-secondary hover:text-white hover:bg-surface-hover',
  surface: 'bg-surface-raised text-txt-secondary hover:text-white border border-surface-border',
  accent: 'bg-accent-500/15 text-accent-400 hover:bg-accent-500/25',
};

export function IconButton({
  icon,
  size = 'md',
  variant = 'ghost',
  badge,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`
        relative inline-flex items-center justify-center rounded-xl
        transition-all duration-fast active:scale-95
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {icon}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center
                         bg-danger-500 text-white text-[10px] font-bold rounded-full px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
