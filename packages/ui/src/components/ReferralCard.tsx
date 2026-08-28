import React from 'react';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';

interface ReferralCardProps {
  friendsJoined: number;
  friendsActivated: number;
  activationThreshold?: number;
  referralCode?: string;
  onInvite: () => void;
  onCopyCode?: () => void;
  className?: string;
}

export function ReferralCard({
  friendsJoined,
  friendsActivated,
  activationThreshold = 10,
  referralCode,
  onInvite,
  onCopyCode,
  className = '',
}: ReferralCardProps) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="text-center mb-4">
        <span className="text-3xl mb-2 block">👥</span>
        <h3 className="text-h3 font-display text-white">Invite Friends</h3>
      </div>

      {/* Stats */}
      <div className="flex justify-around mb-4">
        <div className="text-center">
          <div className="text-score-sm font-score text-white tabular-nums">{friendsJoined}</div>
          <div className="text-caption text-txt-secondary">Joined</div>
        </div>
        <div className="w-px bg-surface-border" />
        <div className="text-center">
          <div className="text-score-sm font-score text-success-400 tabular-nums">{friendsActivated}</div>
          <div className="text-caption text-txt-secondary">Activated</div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-caption text-txt-tertiary">Referral progress</span>
          <span className="text-caption text-accent-400 tabular-nums">
            {friendsActivated}/{activationThreshold}
          </span>
        </div>
        <ProgressBar
          value={friendsActivated}
          max={activationThreshold}
          color="accent"
          size="md"
        />
      </div>

      {/* Referral code */}
      {referralCode && (
        <button
          onClick={onCopyCode}
          className="w-full flex items-center justify-center gap-2 py-2.5 mb-3
                   bg-surface-overlay rounded-xl border border-surface-border
                   text-body-sm text-txt-secondary hover:text-white hover:border-accent-500/30
                   transition-all duration-fast"
        >
          <span className="font-mono font-semibold text-txt-primary">{referralCode}</span>
          <span className="text-caption text-txt-tertiary">📋 Copy</span>
        </button>
      )}

      <Button variant="primary" fullWidth onClick={onInvite}>
        📤 Invite Friends
      </Button>
    </div>
  );
}
