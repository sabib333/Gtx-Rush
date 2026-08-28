import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-1 p-1 bg-surface-raised rounded-xl ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-2 px-3
            text-caption font-semibold rounded-lg transition-all duration-fast
            ${activeTab === tab.id
              ? 'tab-active'
              : 'tab-inactive'
            }
          `}
        >
          {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
          <span>{tab.label}</span>
          {tab.count != null && (
            <span className="ml-1 px-1.5 py-0 text-[10px] bg-white/10 rounded-pill tabular-nums">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
