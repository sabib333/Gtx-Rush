import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendValue,
  className = '',
}: StatCardProps) {
  return (
    <div className={`card p-3.5 ${className}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon && <span className="text-sm">{icon}</span>}
        <span className="text-caption text-txt-secondary">{label}</span>
      </div>
      <div className="text-h2 font-display text-white tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {trend && trendValue && (
        <div className={`text-caption-xs mt-1 ${
          trend === 'up' ? 'text-success-400' :
          trend === 'down' ? 'text-danger-400' :
          'text-txt-tertiary'
        }`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
        </div>
      )}
    </div>
  );
}
