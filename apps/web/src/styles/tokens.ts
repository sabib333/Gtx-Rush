/**
 * GTX Rush Design Tokens
 *
 * These are the programmatic access point for design tokens.
 * Use these when Tailwind classes aren't sufficient (e.g., inline styles, canvas drawing).
 */

export const colors = {
  // Surfaces
  surfaceBase: '#0c1222',
  surfaceRaised: '#131c2e',
  surfaceOverlay: '#1a2540',
  surfaceBorder: '#243049',
  surfaceHover: '#1e2d48',

  // Brand
  accent: '#3366ff',
  accentLight: '#5988ff',
  accentDark: '#1a44f5',
  energy: '#9050ff',
  energyLight: '#b07aff',

  // Status
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',

  // Text
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',

  // Games
  gameReaction: '#ef4444',
  gameTap: '#22c55e',
  gameQuiz: '#a855f7',

  // Rank
  rankGold: '#fbbf24',
  rankSilver: '#9ca3af',
  rankBronze: '#d97706',

  // Rarity
  rarityCommon: '#94a3b8',
  rarityRare: '#3b82f6',
  rarityEpic: '#a855f7',
  rarityLegendary: '#f59e0b',
} as const;

export const gameColors: Record<string, { primary: string; bg: string; glow: string }> = {
  'reaction-rush': {
    primary: colors.gameReaction,
    bg: 'rgba(239, 68, 68, 0.15)',
    glow: 'rgba(239, 68, 68, 0.4)',
  },
  'tap-rush': {
    primary: colors.gameTap,
    bg: 'rgba(34, 197, 94, 0.15)',
    glow: 'rgba(34, 197, 94, 0.4)',
  },
  'quiz-rush': {
    primary: colors.gameQuiz,
    bg: 'rgba(168, 85, 247, 0.15)',
    glow: 'rgba(168, 85, 247, 0.4)',
  },
};

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  '2xl': '2rem',
  '3xl': '3rem',
} as const;

export const radius = {
  sm: '0.375rem',
  md: '0.625rem',
  lg: '0.875rem',
  xl: '1rem',
  '2xl': '1.25rem',
  '3xl': '1.5rem',
  pill: '9999px',
} as const;

export const motion = {
  fast: '100ms',
  normal: '200ms',
  slow: '350ms',
  slower: '500ms',
} as const;
