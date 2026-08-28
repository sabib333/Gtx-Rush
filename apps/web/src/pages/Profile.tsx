import { Link } from 'react-router-dom';
import { Card, Avatar, XPBar, StatCard, Badge, ReferralCard, EmptyState } from '@gtx-rush/ui';

export function Profile() {
  return (
    <div className="page-container">
      {/* Identity */}
      <div className="text-center mb-6 animate-fade-in">
        <Avatar name="Player" size="xl" showLevel level={1} className="mx-auto mb-3" />
        <h1 className="text-h1 font-display text-white">Player</h1>
        <p className="text-body-sm text-txt-secondary">@player • 🌍 Global</p>
      </div>

      {/* Level Progress */}
      <div className="mb-6 animate-slide-up">
        <Card glow>
          <XPBar currentXP={0} nextLevelXP={100} level={1} />
          <div className="flex justify-between mt-2">
            <span className="text-caption-xs text-txt-tertiary">0 XP</span>
            <span className="text-caption-xs text-txt-tertiary">100 XP</span>
          </div>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <StatCard label="Games" value={0} icon="🎮" />
        <StatCard label="Total Score" value={0} icon="📊" />
        <StatCard label="Best Rank" value="#" icon="🏆" />
        <StatCard label="Badges" value={0} icon="🏅" />
      </div>

      {/* Badges */}
      <div className="mb-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <h3 className="section-heading">
          <span>🏅</span> Badges
        </h3>
        <EmptyState
          icon="🏅"
          title="Your first badge is waiting"
          description="Play games and complete challenges to unlock achievements"
        />
      </div>

      {/* Referral */}
      <div className="mb-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
        <ReferralCard
          friendsJoined={0}
          friendsActivated={0}
          referralCode="GTX-ABCD1234"
          onInvite={() => {}}
          onCopyCode={() => {}}
        />
      </div>

      {/* Settings */}
      <div className="animate-slide-up" style={{ animationDelay: '400ms' }}>
        <Card>
          <h3 className="text-body font-bold text-white mb-3">Settings</h3>
          <div className="space-y-0">
            {[
              { label: 'Sound Effects', value: 'ON' },
              { label: 'Haptic Feedback', value: 'ON' },
              { label: 'Notifications', value: 'ON' },
            ].map((item, i) => (
              <div
                key={item.label}
                className={`flex items-center justify-between py-3 ${
                  i < 2 ? 'border-b border-surface-border' : ''
                }`}
              >
                <span className="text-body-sm text-txt-secondary">{item.label}</span>
                <span className="text-body-sm text-accent-400 font-semibold">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
