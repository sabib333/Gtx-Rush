# GTX Rush — Tap Rush Game Contract v1.0

## Tagline: Tap Fast. Score Higher. Rise.

---

## Non-Negotiable Rules

1. **Client score is never trusted.** The server calculates all scores from submitted event sequences.
2. **Game sessions are server-created.** The client must not invent its own valid session.
3. **Game version is stored.** Every session includes a version string for backward-compatible scoring.
4. **Score calculation is deterministic.** The same legitimate performance produces a predictable result.
5. **Completion is idempotent.** Completing the same session twice never awards XP, scores, or achievements twice.
6. **Anti-cheat is extensible.** Rule-based detection is structured for adding new rules without changing core logic.
7. **Shared services must be reused.** Game engine, leaderboard, XP, challenges, sharing, analytics, and Telegram integrations are shared across all games.
8. **XP is awarded only through the centralized progression service.** The frontend never permanently awards XP.
9. **Leaderboards accept only validated results.** Only `VERDICT: VALID` scores appear on competitive leaderboards.
10. **Challenge configuration is server-authoritative.** Daily and friend challenge rules come from the backend.
11. **Gameplay must remain mobile-first.** Touch targets are generous, safe margins avoid Telegram UI, the game area is responsive across 320px–430px+.
12. **Future games should reuse the common game architecture.** Tap Rush demonstrates the pattern for Quiz Rush.

---

## 1. Game Concept

Tap Rush is a fast, mobile-first competitive tapping game. The player receives 15 seconds to tap valid targets as quickly and accurately as possible. Targets appear one at a time; each successful tap spawns the next. A combo system rewards consecutive accuracy. Bonus targets award extra points.

**Core loop:**
```
READY → COUNTDOWN (3-2-1-GO!) → ACTIVE → TARGET APPEARS → PLAYER TAPS →
TARGET CHANGES → ... → TIME EXPIRES → RESULT → RANK → REPLAY / CHALLENGE
```

---

## 2. Game State Machine

```
IDLE ──→ COUNTDOWN ──→ ACTIVE ──→ TIME_UP ──→ RESULT
  │          │            │          │
  │          │            ├──→ PAUSED ──→ ACTIVE (not in competitive modes)
  │          │            │
  │          │            └──→ ABORTED (early exit)
  │          │
  │          └──→ ERROR
  │
  └──→ ERROR
```

**Required states:**
| State | Description |
|-------|-------------|
| `IDLE` | Waiting for player to start |
| `COUNTDOWN` | 3-2-1-GO! before gameplay begins |
| `ACTIVE` | Gameplay in progress; targets spawning, player tapping |
| `PAUSED` | Timer frozen; not used in competitive modes |
| `TIME_UP` | Timer reached zero; result calculation begins |
| `RESULT` | Final score displayed to player |
| `ERROR` | Unrecoverable error occurred |
| `ABORTED` | Player exited before completion |

---

## 3. Score Formula

```
Final Score = Base Score + Combo Bonus + Bonus Target Score − Invalid Tap Penalty
```

Where:
- **Base Score** = Σ (100 × multiplier) for each normal target hit
- **Combo Bonus** = Σ ((100 × multiplier) − 100) for hits above combo threshold
- **Bonus Target Score** = Σ (500 × multiplier) for each bonus target hit
- **Invalid Tap Penalty** = Σ 50 for each invalid tap
- **Final Score** = max(0, Final Score)

---

## 4. Combo Formula

```
multiplier(combo) =
  1.0                                         if combo < threshold (3)
  1.0 + (combo − threshold) × 0.1            otherwise
  capped at 3.0
```

| Combo Count | Multiplier | Effect |
|-------------|-----------|--------|
| 0–2 | ×1.0 | No multiplier |
| 3 | ×1.0 | Threshold reached |
| 4 | ×1.1 | +10% per extra combo |
| 7 | ×1.4 | |
| 13 | ×2.0 | Double points |
| 28 | ×3.0 | Maximum multiplier |

**Invalid tap effect:** Combo is reduced by 5 (not reset to zero) for competitive fairness.

---

## 5. Timer Strategy

- Uses `setInterval` for 1-second tick updates.
- Game duration is 15 seconds (configurable via `TAP_RUSH_CONFIG.durationMs`).
- Monotonic timestamp via `performance.now()` for event recording.
- Server validates total duration independently; cannot be faked.
- No pause in competitive modes.

---

## 6. Target System

- One active target at a time.
- Target position generated within safe margins (60px from edges).
- Minimum 100px distance from previous target position.
- Target auto-expires after 3 seconds if not tapped.
- 10% chance of spawning a bonus target (worth 5× base points).
- Target hit area is 1.2× the visual size for mobile friendliness.

---

## 7. Session Lifecycle

```
Client                     Server
  │                          │
  ├──POST /games/tap-rush/session──→  Create session, return ID + config
  │                          │
  ├──(play locally)──────────│
  │   spawn target           │
  │   tap target             │
  │   record events          │
  │                          │
  ├──POST /games/tap-rush/session/:id/complete──→
  │     { events, durationMs }│
  │                          ├──Validate session
  │                          ├──Validate event structure
  │                          ├──Calculate score server-side
  │                          ├──Run anti-cheat rules
  │                          ├──Store score
  │                          ├──Check personal best
  │                          ├──Calculate XP
  │                          ├──Calculate global rank
  │   ←──────────────────────┤
  │   { score, rank, PB, XP }│
```

---

## 8. Server Validation Flow

On score submission, the server:

1. ✅ Verifies session exists
2. ✅ Verifies session belongs to authenticated user
3. ✅ Verifies session is active (not completed/expired/disqualified)
4. ✅ Verifies session has not expired (duration + buffer)
5. ✅ Validates input sequence structure (event types, ordering, timestamps)
6. ✅ Validates target IDs are unique and all hit targets were spawned
7. ✅ Calculates score server-side (never trusts client score)
8. ✅ Runs anti-cheat rules
9. ✅ Determines verdict: VALID / SUSPICIOUS / REJECTED
10. ✅ Stores score with verdict
11. ✅ Checks personal best
12. ✅ Awards XP through progression service
13. ✅ Returns rank, XP, and personal best status

---

## 9. Anti-Cheat Rules

| Rule | Severity | Description |
|------|----------|-------------|
| `TAP_RATE_EXCEEDED` | HIGH | More than 20 taps/second |
| `TOO_MANY_TAPS` | MEDIUM | More than 500 total taps in 15s |
| `TAP_REGULARITY` | HIGH | Tap intervals have coefficient of variation < 0.02 (bot-like) |
| `IMPOSSIBLE_TAP_INTERVAL` | CRITICAL | Tap interval < 30ms |
| `IDENTICAL_TIMESTAMPS` | CRITICAL | All tap timestamps are identical (replay) |
| `HIT_WITHOUT_SPAWN` | CRITICAL | Tap on target that was never spawned |
| `DUPLICATE_TARGET_IDS` | CRITICAL | Multiple targets with same ID |
| `SESSION_TIME_BOUNDS` | CRITICAL | Total event duration exceeds game duration + 5s |

**Verdict logic:**
- `VALID` — fraudScore < 10
- `SUSPICIOUS` — fraudScore 10–99 (reviewed, held from leaderboard)
- `REJECTED` — fraudScore ≥ 100 (disqualified, no leaderboard score)

---

## 10. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/games/tap-rush/session` | Create a new game session |
| POST | `/api/games/tap-rush/session/:sessionId/complete` | Submit events, get validated score |
| GET | `/api/games/tap-rush/stats` | Get user's Tap Rush statistics |
| GET | `/api/games/tap-rush/leaderboard` | Get game-specific leaderboard |

---

## 11. Database Changes

**None.** All Tap Rush data uses the existing generic game tables:
- `games` — game definition
- `game_versions` — version tracking
- `game_sessions` — session records
- `game_scores` — validated scores with breakdown
- `leaderboard_entries` — leaderboard positions
- `daily_challenges` — daily challenge config
- `challenge_attempts` — daily challenge attempts
- `friend_challenges` — friend challenge records
- `xp_transactions` — XP awards
- `fraud_flags` — anti-cheat flags

---

## 12. Reused Shared Systems

| System | Package/Module |
|--------|---------------|
| Game Engine | `@gtx-rush/game-engine` (BaseGame, GameRegistry, SessionManager, AntiCheat) |
| Types | `@gtx-rush/types` (GameInput, GameResult, GameSession, etc.) |
| Config | `@gtx-rush/config` (GAME_DEFINITIONS, ANTI_CHEAT_CONFIG) |
| UI Components | `@gtx-rush/ui` (GameHeader, GameLaunch, GameResult, Countdown) |
| Telegram | `@gtx-rush/telegram` (haptics, share, viewport) |
| Analytics | `@gtx-rush/analytics` |
| Validation | `@gtx-rush/validation` |

---

## 13. Analytics Events

| Event | Trigger |
|-------|---------|
| `tap_game_opened` | Player opens Tap Rush |
| `tap_game_started` | Session created successfully |
| `tap_target_spawned` | New target appears |
| `tap_target_hit` | Valid tap on target |
| `tap_invalid` | Tap outside valid target |
| `tap_combo_started` | Combo reaches threshold (3+) |
| `tap_combo_milestone` | Combo reaches 5, 10, 15, 20+ |
| `tap_game_completed` | Timer expires |
| `tap_score_submitted` | Score submitted to server |
| `tap_personal_best` | New personal best achieved |
| `tap_challenge_completed` | Friend challenge finished |
| `tap_game_aborted` | Player exits before completion |

---

## 14. Configuration (No Magic Numbers)

All values centralized in `games/tap-rush/src/config.ts`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `durationMs` | 15,000 | Game duration |
| `countdownDuration` | 3 | Countdown before start |
| `targetSizePx` | 56 | Target radius in pixels |
| `safeMarginPx` | 60 | Edge margin for target placement |
| `normalTargetPoints` | 100 | Points per normal target |
| `bonusTargetPoints` | 500 | Points per bonus target |
| `invalidTapPenalty` | 50 | Penalty per invalid tap |
| `comboThreshold` | 3 | Taps before multiplier activates |
| `comboMultiplierIncrement` | 0.1 | Multiplier increase per combo |
| `comboMultiplierMax` | 3.0 | Maximum multiplier |
| `comboBreakReduction` | 5 | Combo lost per invalid tap |
| `bonusTargetProbability` | 0.1 | Chance of bonus target (10%) |
| `targetLifetimeMs` | 3,000 | Auto-expire after 3 seconds |
| `maxTapRatePerSecond` | 20 | Anti-cheat threshold |
| `maxTotalTaps` | 500 | Anti-cheat threshold |
| `minTapIntervalMs` | 30 | Minimum time between taps |

---

## 15. Known Limitations (MVP)

- Daily Challenge and Friend Challenge are wired at the session level but full challenge orchestration (daily config generation, friend challenge tokens) follows the existing patterns in `reaction-rush`.
- Sound is not implemented in MVP (optional hooks noted in contract but not built).
- Pause is disabled for competitive fairness.
- Haptic feedback is wired through the existing Telegram abstraction but not yet triggered on all events (available for integration).
- Anti-cheat uses rule-based detection only (no ML, as specified).

---

## 16. Confirmation: Previous Contracts Intact

- ✅ GTX Rush Architecture Contract v1.0 — Shared game engine, types, config, and database schema reused without modification.
- ✅ GTX Rush UI/UX Contract v1.0 — Shared UI components (`GameHeader`, `GameLaunch`, `GameResult`, `Countdown`) reused. No new design system created.
- ✅ GTX Rush Telegram Integration Contract v1.0 — Telegram hooks (`useHaptic`, `useShare`, `useViewport`) available and wired.
- ✅ Reaction Rush Game Contract v1.0 — No changes to Reaction Rush code. Both games coexist via the shared game engine and registry pattern.
