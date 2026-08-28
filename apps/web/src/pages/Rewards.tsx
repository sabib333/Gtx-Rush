import { useState } from 'react';
import { Card, XPBar, ProgressBar, RewardCard, Badge, Tabs, EmptyState } from '@gtx-rush/ui';
import { Streak } from '@gtx-rush/ui';

type TabType = 'progress' | 'badges' | 'cosmetics' | 'premium';

const badges = [
  { name: 'First Game', icon: '🎮', rarity: 'common' as const, owned: true },
  { name: 'Speed Demon', icon: '⚡', rarity: 'rare' as const, owned: true },
  { name: 'Streak Master', icon: '🔥', rarity: 'epic' as const, owned: false },
  { name: 'Quiz King', icon: '🧠', rarity: 'legendary' as const, owned: false },
];

const cosmetics = [
  { name: 'Bronze Frame', icon: '🖼️', rarity: 'common' as const, owned: true, equipped: true },
  { name: 'Silver Frame', icon: '🖼️', rarity: 'rare' as const, owned: true },
  { name: 'Gold Frame', icon: '🖼️', rarity: 'epic' as const, owned: false, price: 50 },
  { name: 'Diamond Frame', icon: '💎', rarity: 'legendary' as const, owned: false, price: 200 },
];

const tabs = [
  { id: 'progress', label: 'Progress', icon: '📊' },
  { id: 'badges', label: 'Badges', icon: '🏅' },
  { id: 'cosmetics', label: 'Style', icon: '🎨' },
  { id: 'premium', label: 'Premium', icon: '⭐' },
];

export function Rewards() {
  const [activeTab, setActiveTab] = useState<TabType>('progress');

  return (
    <div className="page-container">
      <h1 className="text-h1 font-display text-white mb-4 animate-fade-in">Rewards</h1>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabType)}
        className="mb-6"
      />

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <div className="space-y-4 animate-fade-in">
          {/* XP Progress */}
          <Card glow>
            <h3 className="text-body font-bold text-white mb-3">Level Progress</h3>
            <XPBar currentXP={0} nextLevelXP={100} level={1} />
            <div className="flex justify-between mt-2">
              <span className="text-caption-xs text-txt-tertiary">0 XP</span>
              <span className="text-caption-xs text-txt-tertiary">100 XP to Level 2</span>
            </div>
          </Card>

          {/* Streak */}
          <Streak
            currentStreak={0}
            longestStreak={0}
            weekDays={[false, false, false, false, false, false, false]}
          />

          {/* Stats */}
          <Card>
            <h3 className="text-body font-bold text-white mb-3">This Week</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-surface-overlay rounded-xl">
                <div className="text-score-sm font-score text-white">0</div>
                <div className="text-caption text-txt-secondary">Games</div>
              </div>
              <div className="text-center p-3 bg-surface-overlay rounded-xl">
                <div className="text-score-sm font-score text-accent-400">0</div>
                <div className="text-caption text-txt-secondary">XP Earned</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Badges Tab */}
      {activeTab === 'badges' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            {badges.map((badge) => (
              <RewardCard
                key={badge.name}
                name={badge.name}
                icon={badge.icon}
                rarity={badge.rarity}
                owned={badge.owned}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cosmetics Tab */}
      {activeTab === 'cosmetics' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            {cosmetics.map((item) => (
              <RewardCard
                key={item.name}
                name={item.name}
                icon={item.icon}
                rarity={item.rarity}
                owned={item.owned}
                equipped={item.equipped}
                price={item.price}
              />
            ))}
          </div>
        </div>
      )}

      {/* Premium Tab */}
      {activeTab === 'premium' && (
        <div className="animate-fade-in">
          <Card glow className="mb-4">
            <div className="text-center py-4">
              <span className="text-4xl mb-3 block">⭐</span>
              <h3 className="text-h3 font-display text-white mb-1">GTX Rush Premium</h3>
              <p className="text-body-sm text-txt-secondary mb-4">
                Exclusive cosmetics, bonus XP, and more!
              </p>
              <div className="text-body font-bold text-warning-400">
                Coming Soon
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
