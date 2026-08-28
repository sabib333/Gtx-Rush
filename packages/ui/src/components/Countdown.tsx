import React, { useEffect, useState } from 'react';

interface CountdownProps {
  from?: number;
  onComplete: () => void;
  className?: string;
}

export function Countdown({ from = 3, onComplete, className = '' }: CountdownProps) {
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (count <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCount((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <div className={`fixed inset-0 bg-surface-base/95 backdrop-blur-sm flex items-center justify-center z-50 ${className}`}>
      <div className="text-center">
        {count > 0 ? (
          <div key={count} className="animate-bounce-in">
            <span className="text-display-xl font-score text-white tabular-nums">
              {count}
            </span>
          </div>
        ) : (
          <div className="animate-pop">
            <span className="text-display-lg font-display text-accent-400 font-black uppercase tracking-wider">
              GO!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
