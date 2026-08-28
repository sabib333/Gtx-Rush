import React from 'react';

type RewardRarity = 'common' | 'rare' | 'epic' | 'legendary';

interface RewardCardProps {
  name: string;
  description?: string;
  icon: string;
  rarity: RewardRarity;
  owned?: boolean;
  equipped?: boolean;
  price?: number; // Telegram Stars
  onClick?: () => void;
  className?: string;
}

const rarityConfig: Record<RewardRarity, { border: string; bg: string; label: string }> = {
  common: { border: 'border-rarity-common/30', bg: 'bg-rarity-common/10', label: 'Common' },
  rare: { border: 'border-rarity-rare/30', bg: 'bg-rarity-rare/10', label: 'Rare' },
  epic: { border: 'border-rarity-epic/30', bg: 'bg-rarity-epic/10', label: 'Epic' },
  legendary: { border: 'border-rarity-legendary/30', bg: 'bg-rarity-legendary/10', label: 'Legendary' },
};

export function RewardCard({
  name,
  description,
  icon,
  rarity,
  owned = false,
  equipped = false,
  price,
  onClick,
  className = '',
}: RewardCardProps) {
  const config = rarityConfig[rarity];

  return (
    <button
      onClick={onClick}
      className={`
        card-interactive p-3 text-left ${config.border}
        ${owned ? '' : 'opacity-60'}
        ${className}
      `}
    >
      <div className={`w-full aspect-square ${config.bg} rounded-xl flex items-center justify-center text-3xl mb-2`}>
        {icon}
      </div>
      <div className="text-caption font-semibold text-txt-primary truncate">{name}</div>
      <div className="text-caption-xs text-txt-tertiary truncate">{config.label}</div>
      {equipped && (
        <div className="text-caption-xs text-accent-400 mt-1 font-semibold">Equipped</div>
      )}
      {!owned && price != null && (
        <div className="text-caption-xs text-warning-400 mt-1 font-semibold">⭐ {price}</div>
      )}
    </button>
  );
}
