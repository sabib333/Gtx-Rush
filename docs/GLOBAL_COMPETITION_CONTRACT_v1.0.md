# GTX Rush — Global Competition Contract v1.0

## Non-Negotiable Rules

1. Only validated game sessions create competitive scores.
2. Client-side scores are never trusted.
3. Rankings are deterministic.
4. Historical rankings remain immutable.
5. Seasons are versioned.
6. Season rewards are idempotent.
7. Badges cannot be duplicated.
8. XP transactions are auditable.
9. Suspicious scores do not immediately enter trusted rankings.
10. Profile privacy must be respected.
11. Competitive progression must not require payment.
12. Cosmetic/status rewards must not create gameplay advantages.
13. All games use the same ranking infrastructure.
14. Future tournaments must extend this system rather than replace it.

---

## A. Global Ranking Architecture

### Design
One generalized ranking service with configurable scopes. Not separate ranking engines.

### Scopes
| Scope | Description | Query Key |
|-------|-------------|-----------|
| `global` | All users, all games | `global:*:*:*:*` |
| `country` | Users filtered by country | `country:*:*:US:*` |
| `game` | Game-specific rankings | `game:score:reaction-rush:*:*` |
| `weekly` | Rolling 7-day window | `weekly:*:*:*:week-2026-W34` |
| `season` | Season-scoped | `season:season:*:*:season-1` |
| `friends` | Among connections | `friends:*:*:*:*` |

### Ranking Types
| Type | Used For | Source |
|------|----------|--------|
| `score` | Competitive games | Best game scores |
| `xp` | Progression | Total XP earned |
| `season` | Long-term competition | Composite season score |

### Tie-Breaking (Deterministic)
1. Higher score wins
2. If tied, earlier submission wins (lower tie-breaker timestamp)
3. Never random

### Pagination
- Cursor-based pagination (not offset)
- "Around me" view: Top 3 + user position + nearby entries
- Never load entire leaderboard into client

---

## B. Global Player Profile

### Profile Data
```
⚡ GTX RUSH PROFILE

Level 27
XP: 4,820 / 5,500

Global #12,842
Season #4,219

Tier: Gold III

Wins: 84
Games: 1,247
Best Score: 18,420

Badges: 🏆 ⚡ 🔥 🧠
Title: Speed Demon

Streak: 12 days
```

### Privacy
- Public: Profile visible to all
- Friends: Visible to connections only
- Private: Hidden from public views

---

## C. Season System

### Lifecycle
```
UPCOMING → ACTIVE → ENDED → ARCHIVED
```

### Season Configuration
```json
{
  "scoringFormula": {
    "bestScoresWeight": 0.6,
    "challengeWinsWeight": 0.2,
    "dailyParticipationWeight": 0.1,
    "xpEarnedWeight": 0.1
  },
  "dailyChallengeWeight": 0.2,
  "challengeWinWeight": 0.2,
  "maxDailyScoresPerGame": 3
}
```

### Season Score Formula
```
seasonScore = (normalized_bestScores × 0.6) +
              (normalized_challengeWins × 0.2) +
              (normalized_dailyParticipation × 0.1) +
              (normalized_xpEarned × 0.1)

All values normalized to 0-1000 scale.
```

### Season Transitions
| From | To | Trigger |
|------|-----|---------|
| UPCOMING | ACTIVE | Admin/scheduler starts season |
| ACTIVE | ENDED | Season end time reached |
| ENDED | ARCHIVED | Admin archives season |

### Reward Distribution
| Rank Range | XP | Badge | Title |
|-----------|-----|-------|-------|
| 1-10 | 1000 | Season Champion | Season Champion |
| 11-100 | 500 | Top 100 | — |
| 101-1000 | 200 | Top 1K | — |
| 1001-10000 | 100 | Top 10K | — |

### Idempotency
- Each reward distributed once per user per season
- `idempotencyKey` prevents duplicates
- Reward transactions are auditable

---

## D. Tier System

### Tiers
| Tier | Score Range | Divisions |
|------|-------------|-----------|
| Bronze | 0-299 | I, II, III |
| Silver | 300-699 | I, II, III |
| Gold | 700-1199 | I, II, III |
| Platinum | 1200-1799 | I, II, III |
| Diamond | 1800-2499 | I, II, III |
| Master | 2500-3499 | I, II, III |
| Legend | 3500+ | No divisions |

### Promotion/Demotion
- Tier changes based on season score
- Promoted when score exceeds tier threshold
- Demoted when score drops below tier threshold
- Historical tier changes preserved

---

## E. Badge System

### Evaluation Flow
```
Game completed → Badge service evaluates criteria → Badge unlocked
                                                    ↓
                                              Reward transaction
                                                    ↓
                                              Notification
                                                    ↓
                                              Analytics event
```

### Initial Badges (11)

| Badge | Category | Criteria | Rarity |
|-------|----------|----------|--------|
| First Rush | gameplay | Play first game | Common |
| Speed Demon | gameplay | Reaction Rush 8000+ | Rare |
| Tap Master | gameplay | Tap Rush 10000+ | Rare |
| Quiz Brain | gameplay | Quiz Rush 5000+ | Rare |
| Perfect Game | gameplay | Perfect score | Epic |
| Dedicated Rusher | gameplay | Play 100 games | Uncommon |
| Rush Veteran | gameplay | Play 1000 games | Epic |
| Challenger | social | Complete 1 challenge | Common |
| Champion | social | Win 10 challenges | Rare |
| Rising Star | progression | Reach Level 5 | Common |
| Hot Streak | progression | 7-day streak | Uncommon |

### Criteria Types
- `games_played`: Total games played
- `score_reached`: Game-specific score threshold
- `level_reached`: XP level threshold
- `streak_days`: Activity streak days
- `challenges_completed`: Friend challenges done
- `challenges_won`: Friend challenges won
- `rank_reached`: Global rank threshold
- `tier_reached`: Tier threshold
- `perfect_game`: Perfect game completion

### Duplicate Prevention
- Each badge earned once per user
- Unique index on `(userId, badgeId)`
- Idempotent unlock attempts

---

## F. Title System

### Available Titles
| Title | Category | Rarity |
|-------|----------|--------|
| Rookie | progression | Common |
| Rusher | progression | Common |
| Speed Demon | gameplay | Rare |
| Tap Master | gameplay | Rare |
| Quiz Master | gameplay | Rare |
| Challenger | social | Uncommon |
| Champion | social | Rare |
| Elite | competition | Epic |
| Season Champion | competition | Legendary |
| Legend | competition | Legendary |

### Equip
- User selects one title for profile display
- Equipped title shown on leaderboards and profiles
- Titles are cosmetic — no gameplay advantages

---

## G. XP Integration

### XP Sources
| Source | Base XP | Daily Limit |
|--------|---------|-------------|
| Game Play | 10 | 100 |
| Game Win | 25 | 250 |
| Daily Challenge | 50 | 50 |
| Streak | 5 | 100 |
| Friend Challenge | 30 | 150 |
| Achievement | Variable | — |

### Level Formula
```
Level 1: 0 XP
Level 2: 100 XP
Level 3: 300 XP
Level 4: 600 XP
Level 5: 1000 XP
Level 6: 1500 XP
Level 7: 2200 XP
Level 8: 3000 XP
Level 9: 4000 XP
Level 10: 5500 XP
```

### Streak Multiplier
- 7+ days: 1.5× XP
- 30+ days: 2.0× XP

### Security
- All XP server-authoritative
- Daily limits prevent farming
- Transactions are idempotent and auditable

---

## H. API Endpoints

### Rankings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rankings/:scope` | Leaderboard by scope |
| GET | `/api/rankings/:scope/around` | Around-me view |
| GET | `/api/rankings/:scope/rank` | User's rank |
| GET | `/api/users/me/ranks` | All user ranks |

### Seasons
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/seasons/current` | Active season |
| GET | `/api/seasons/history` | All seasons |
| GET | `/api/seasons/:id` | Season details |
| GET | `/api/seasons/:id/rankings` | Season leaderboard |
| GET | `/api/seasons/:id/rewards` | Season rewards |
| GET | `/api/users/me/seasons` | User's season history |

### Achievements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me/badges` | User's badges |
| POST | `/api/users/me/badges/:slug/view` | Mark badge viewed |
| GET | `/api/users/me/titles` | User's titles |
| POST | `/api/users/me/titles/:slug/equip` | Equip title |
| GET | `/api/users/me/profile` | Full profile |
| GET | `/api/users/:id/profile` | Public profile |
| GET | `/api/badges` | All badge definitions |
| GET | `/api/titles` | All title definitions |

---

## I. Database Schema

### New Tables
- `seasons` — Season definitions
- `season_rankings` — Per-user season scores
- `rank_snapshots` — Historical rank records
- `tier_definitions` — Configurable tier thresholds
- `user_tiers` — Per-user tier per season
- `user_badges_v2` — Extended badge records
- `titles` — Title definitions
- `user_titles` — Per-user title unlocks
- `reward_transactions` — Idempotent reward log
- `user_profile_extensions` — Privacy, equipped title, best ranks

### Reused Tables
- `users` — User data
- `game_sessions` — Validated sessions
- `game_scores` — Competitive scores
- `xp_transactions` — XP ledger
- `badges` — Badge definitions
- `leaderboards` — Leaderboard metadata
- `leaderboard_entries` — Leaderboard data
- `fraud_flags` — Anti-cheat

---

## J. Scheduled Jobs

| Job | Interval | Description |
|-----|----------|-------------|
| `weekly-ranking-snapshot` | Weekly | Create weekly rank snapshots |
| `season-transition-check` | Hourly | Check if season should end |
| `tier-calculation` | 6 hours | Update tier assignments |
| `daily-rank-snapshot` | Daily | Create daily rank snapshots |

All jobs are idempotent and safe to retry.

---

## K. Analytics Events

| Event | Properties |
|-------|------------|
| `leaderboard_opened` | scope, type |
| `leaderboard_viewed` | scope, type, position |
| `rank_changed` | oldRank, newRank, scope |
| `tier_promoted` | fromTier, toTier |
| `tier_dropped` | fromTier, toTier |
| `season_started` | seasonId, seasonNumber |
| `season_completed` | seasonId, finalRank |
| `badge_unlocked` | badgeSlug, category, rarity |
| `badge_viewed` | badgeSlug |
| `title_unlocked` | titleSlug |
| `level_up` | oldLevel, newLevel |
| `season_reward_claimed` | seasonId, rank, xp |

---

## L. Security Model

### Server Authority
- All rankings calculated server-side
- Tier assignments server-side
- Badge criteria evaluated server-side
- XP awarded server-side

### Anti-Cheat Integration
- Only VALID scores enter rankings
- SUSPICIOUS scores held for review
- REJECTED scores never enter rankings

### Resistance To
- Score injection: Server validates all game sessions
- Duplicate scores: Unique session→score mapping
- Replay: Session tokens are single-use
- XP duplication: Idempotent transactions
- Badge duplication: Unique user→badge index
- Rank manipulation: Server-calculated rankings

---

## M. Performance Considerations

### Current Architecture
- In-memory stores for development
- O(n) ranking queries

### Production Optimizations
1. PostgreSQL with proper indexes
2. Redis caching for top leaderboards
3. Materialized views for complex queries
4. Cursor-based pagination
5. Background jobs for heavy computations

### Scaling Targets
- 10K users: ✅ Current architecture
- 100K users: Add Redis + materialized views
- 1M users: Shard by game/region

---

## N. Previous Contracts — Intact Confirmation

1. ✅ GTX Rush Architecture Contract v1.0
2. ✅ GTX Rush UI/UX Contract v1.0
3. ✅ GTX Rush Telegram Integration Contract v1.0
4. ✅ Reaction Rush Game Contract v1.0
5. ✅ Tap Rush Game Contract v1.0
6. ✅ Quiz Rush Game Contract v1.0
7. ✅ Challenge Engine Contract v1.0

The Global Competition System is an **additive layer** that wraps existing game sessions, challenges, and progression with competitive context. No existing logic was modified or forked.

---

## O. Final Success Condition

A user can now:
1. ✅ Open GTX Rush
2. ✅ Play any game → Get validated score
3. ✅ Earn XP → Level up
4. ✅ Climb global rank
5. ✅ Earn badge
6. ✅ Reach a tier
7. ✅ Compete in a season
8. ✅ Play Daily Rush
9. ✅ Challenge friends
10. ✅ See their position
11. ✅ Share achievements
12. ✅ Return tomorrow

**Result**: "Not just games. A competitive identity."

---

*GTX Rush — Global Competition Contract v1.0*
*Generated with Codebuff 🤖*
