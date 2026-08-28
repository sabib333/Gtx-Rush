import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  showClose?: boolean;
}

const sizeClasses = {
  sm: 'max-w-xs',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
}: ModalProps) {
  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Content */}
      <div
        className={`
          relative z-10 w-full ${sizeClasses[size]} mx-4 mb-0 sm:mb-0
          bg-surface-overlay border border-surface-border rounded-t-3xl sm:rounded-3xl
          p-6 shadow-elevated animate-slide-up
        `}
      >
        {/* Handle bar on mobile */}
        <div className="sm:hidden flex justify-center mb-4">
          <div className="w-10 h-1 bg-surface-border rounded-pill" />
        </div>

        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between mb-4">
            {title && (
              <h2 className="text-h2 font-display text-white">{title}</h2>
            )}
            {showClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg
                         text-txt-tertiary hover:text-white hover:bg-surface-hover
                         transition-colors duration-fast"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
