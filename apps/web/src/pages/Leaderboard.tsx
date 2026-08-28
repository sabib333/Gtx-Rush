import { useState } from 'react';
import { Tabs, Leaderboard as LeaderboardList } from '@gtx-rush/ui';

type TabType = 'global' | 'weekly' | 'friends' | 'country';

const mockEntries = [
  { rank: 1, userId: '1', displayName: 'Alex', score: 98420, level: 12, avatarUrl: null },
  { rank: 2, userId: '2', displayName: 'Karim', score: 96180, level: 11, avatarUrl: null },
  { rank: 3, userId: '3', displayName: 'Rahim', score: 94920, level: 10, avatarUrl: null },
  { rank: 4, userId: '4', displayName: 'Sara', score: 92100, level: 10, avatarUrl: null },
  { rank: 5, userId: '5', displayName: 'Nadia', score: 89750, level: 9, avatarUrl: null },
  { rank: 6, userId: '6', displayName: 'Omar', score: 87200, level: 9, avatarUrl: null },
  { rank: 7, userId: '7', displayName: 'Fatima', score: 85100, level: 8, avatarUrl: null },
  { rank: 8, userId: '8', displayName: 'Hasan', score: 83400, level: 8, avatarUrl: null },
];

const tabs = [
  { id: 'global', label: 'Global', icon: '🌍' },
  { id: 'weekly', label: 'Weekly', icon: '📅' },
  { id: 'friends', label: 'Friends', icon: '👥' },
  { id: 'country', label: 'Country', icon: '🏁' },
];

export function Leaderboard() {
  const [activeTab, setActiveTab] = useState<TabType>('global');

  return (
    <div className="page-container">
      <h1 className="text-h1 font-display text-white mb-4 animate-fade-in">
        🏆 Leaderboard
      </h1>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabType)}
        className="mb-6 animate-slide-up"
      />

      <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
        <LeaderboardList
          entries={mockEntries}
          currentUserId="current"
        />
      </div>
    </div>
  );
}
