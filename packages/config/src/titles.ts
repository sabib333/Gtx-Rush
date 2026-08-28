/**
 * GTX Rush — Title Definitions Configuration
 *
 * Profile titles that users can equip for status display.
 * Titles are cosmetic/status features — no gameplay advantages.
 */

import type { Title } from '@gtx-rush/types';

export interface TitleDefinition {
  slug: string;
  name: string;
  description: string;
  category: string;
  rarity: Title['rarity'];
  iconUrl: string;
}

export const TITLE_DEFINITIONS: TitleDefinition[] = [
  // ── Starter ───────────────────────────────────────────
  {
    slug: 'rookie',
    name: 'Rookie',
    description: 'Just getting started.',
    category: 'progression',
    rarity: 'common',
    iconUrl: '🎖️/rookie.png',
  },
  {
    slug: 'rusher',
    name: 'Rusher',
    description: 'A regular at the arena.',
    category: 'progression',
    rarity: 'common',
    iconUrl: '🎖️/rusher.png',
  },

  // ── Gameplay ──────────────────────────────────────────
  {
    slug: 'speed_demon',
    name: 'Speed Demon',
    description: 'Lightning-fast reflexes.',
    category: 'gameplay',
    rarity: 'rare',
    iconUrl: '🎖️/speed_demon.png',
  },
  {
    slug: 'tap_master',
    name: 'Tap Master',
    description: 'Unmatched tapping precision.',
    category: 'gameplay',
    rarity: 'rare',
    iconUrl: '🎖️/tap_master.png',
  },
  {
    slug: 'quiz_master',
    name: 'Quiz Master',
    description: 'A walking encyclopedia.',
    category: 'gameplay',
    rarity: 'rare',
    iconUrl: '🎖️/quiz_master.png',
  },

  // ── Social ────────────────────────────────────────────
  {
    slug: 'challenger',
    name: 'Challenger',
    description: 'Never backs down from a challenge.',
    category: 'social',
    rarity: 'uncommon',
    iconUrl: '🎖️/challenger.png',
  },
  {
    slug: 'champion',
    name: 'Champion',
    description: 'Conquers all challengers.',
    category: 'social',
    rarity: 'rare',
    iconUrl: '🎖️/champion.png',
  },

  // ── Competition ───────────────────────────────────────
  {
    slug: 'elite',
    name: 'Elite',
    description: 'Among the best.',
    category: 'competition',
    rarity: 'epic',
    iconUrl: '🎖️/elite.png',
  },
  {
    slug: 'season_champion',
    name: 'Season Champion',
    description: 'Dominated a competitive season.',
    category: 'competition',
    rarity: 'legendary',
    iconUrl: '🎖️/season_champion.png',
  },
  {
    slug: 'legend',
    name: 'Legend',
    description: 'The name is known everywhere.',
    category: 'competition',
    rarity: 'legendary',
    iconUrl: '🎖️/legend.png',
  },
];

/**
 * Get title definition by slug.
 */
export function getTitleBySlug(slug: string): TitleDefinition | undefined {
  return TITLE_DEFINITIONS.find((t) => t.slug === slug);
}
