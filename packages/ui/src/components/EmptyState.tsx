import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon = '🎮',
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <span className="text-5xl mb-4 animate-bounce-in">{icon}</span>
      <h3 className="text-h3 font-display text-txt-primary mb-1">{title}</h3>
      {description && (
        <p className="text-body-sm text-txt-secondary max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary mt-4"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
