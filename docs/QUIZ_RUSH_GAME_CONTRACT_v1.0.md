# GTX Rush — Quiz Rush Game Contract v1.0

## Tagline: Think Fast. Answer Faster. Rise.

---

## Non-Negotiable Rules

1. **Correct answers are never exposed before answer submission.** The server redacts `correctOptionId` from all question payloads sent to the client.
2. **Server controls question selection.** Questions are randomly selected server-side; the client cannot influence which questions appear.
3. **Server validates answers.** Correctness is determined by server-side lookup, not client claims.
4. **Client never controls final score.** The server calculates the authoritative score from all recorded answers.
5. **Game version is stored.** Every session includes a version string for backward-compatible scoring.
6. **Question versions are stored.** Questions have version numbers; historical sessions remain tied to the question version used.
7. **Completion is idempotent.** Completing the same session twice never awards XP, scores, or achievements twice.
8. **Anti-cheat is extensible.** Rule-based detection is structured for adding new rules without changing core logic.
9. **Leaderboards accept validated scores only.** Only `VERDICT: VALID` scores appear on competitive leaderboards.
10. **XP comes from the centralized progression system.** The frontend never permanently awards XP.
11. **Challenge configuration is server-authoritative.** Daily and friend challenge rules come from the backend.
12. **Quiz content must be original/licensed and factually reviewed.** No third-party copyrighted content.
13. **Shared GTX Rush UI and Telegram systems must be reused.** No new design systems.
14. **Future quiz categories must not require rewriting the quiz engine.** Categories are data-driven.

---

## 1. Game Concept

Quiz Rush is a fast competitive knowledge game. Players answer 10 multiple-choice questions as quickly and accurately as possible. Score includes base points, speed bonus, streak bonus, and difficulty bonus. A session takes approximately 1–3 minutes.

**Core loop:**
```
READY → COUNTDOWN (3-2-1-GO!) → QUESTION → ANSWER → NEXT QUESTION → ... → RESULT → RANK → REPLAY / CHALLENGE
```

---

## 2. State Machine

```
IDLE ──→ COUNTDOWN ──→ QUESTION_ACTIVE ──→ ANSWER_SUBMITTED ──→ NEXT_QUESTION
             │                │                    │                    │
             │                │                    │                    └──→ (loop back to QUESTION_ACTIVE)
             │                │                    │
             │                │                    └──→ GAME_COMPLETE ──→ RESULT ──→ REVIEW
             │                │
             │                └──→ PAUSED ──→ QUESTION_ACTIVE
             │
             └──→ ERROR / ABORTED
```

| State | Description |
|-------|-------------|
| `IDLE` | Waiting for player to start |
| `COUNTDOWN` | 3-2-1-GO! before first question |
| `QUESTION_ACTIVE` | Question displayed, timer running |
| `ANSWER_SUBMITTED` | Answer locked, showing feedback |
| `NEXT_QUESTION` | Transitioning to next question |
| `GAME_COMPLETE` | All questions answered |
| `RESULT` | Final score displayed |
| `REVIEW` | Post-game answer review |
| `PAUSED` | Timer frozen (normal mode only) |
| `ABORTED` | Player exited before completion |
| `ERROR` | Unrecoverable error |

---

## 3. Scoring Formula

```
Total Score = Σ (Base Score × Difficulty Multiplier + Speed Bonus + Streak Bonus)
```

Where:

**Base Score:** 500 points per correct answer

**Difficulty Multiplier:**
| Difficulty | Multiplier |
|-----------|-----------|
| Easy | ×1.0 |
| Medium | ×1.5 |
| Hard | ×2.0 |

**Speed Bonus:**
```
speedBonus = baseScore × (1 - timeToAnswerMs / timeLimitMs) × 0.5
```
Maximum speed bonus is 50% of the base score. Instant answer → full speed bonus. Answer at time limit → zero speed bonus.

**Streak Bonus:**
```
streakMultiplier = 1.0                            if streak ≤ 2
                 = min(1.0 + (streak-2) × 0.1, 2.0)  if streak > 2
streakBonus = baseScore × (streakMultiplier - 1.0)
```
Example: 5 correct in a row → streak multiplier ×1.3 → 30% bonus on top of base score.

---

## 4. Speed Bonus Design

- Correctness is always more important than speed.
- Maximum speed bonus is capped at 50% of base score to prevent speed-only dominance.
- Timer uses monotonic `performance.now()` for accuracy across rendering fluctuations.
- Server validates that answer time is within acceptable bounds.

---

## 5. Streak System

- Streak increments on each consecutive correct answer.
- Streak resets to 0 on incorrect answer or timeout.
- Streak bonus activates after 2 consecutive correct answers.
- Maximum streak multiplier is capped at ×2.0.
- Streak is displayed prominently during gameplay for motivation.

---

## 6. Question Security Model

```
Client                              Server
  │                                   │
  ├──POST /session──→                 │
  │                  ├──Select questions
  │                  ├──Redact correctAnswer
  │   ←─question────┤
  │                                   │
  ├──POST /answer───→                 │
  │   {questionId,                   │
  │    selectedOptionId}              │
  │                  ├──Lookup correct answer
  │                  ├──Validate answer exists
  │                  ├──Check time bounds
  │                  ├──Calculate score
  │   ←─result──────┤
  │   {correct, score, streak,       │
  │    explanation, nextQuestion}     │
```

**Critical security properties:**
- The client NEVER receives `correctOptionId` before answering.
- The server NEVER sends the full question database to the client.
- Questions are selected randomly server-side per session.
- Answer correctness is determined server-side only.

---

## 7. Session Lifecycle

1. Client creates session → Server selects 10 questions, returns first question (without answer)
2. Client displays question with timer
3. Player selects answer → Client sends to server
4. Server validates answer, calculates score, returns result + next question
5. Repeat steps 2-4 for all questions
6. Client requests session completion → Server calculates final authoritative result
7. Server returns: score, rank, XP, accuracy, streak, personal best

---

## 8. Answer Validation Flow

Server validates each answer:
1. ✅ Session exists and belongs to user
2. ✅ Session is active
3. ✅ Question belongs to this session
4. ✅ Question hasn't been answered yet (no duplicates)
5. ✅ Answer option exists
6. ✅ Answer was submitted within valid time bounds
7. ✅ Correct answer matches server-side data
8. ✅ Calculate score using authoritative formula

---

## 9. Anti-Cheat Rules

| Rule | Severity | Description |
|------|----------|-------------|
| `ANSWER_TOO_FAST` | CRITICAL | Answer time < 500ms |
| `CONSISTENT_TIMING` | HIGH | Answer intervals have CV < 0.02 (bot-like) |
| `DUPLICATE_ANSWER` | CRITICAL | Same question answered twice |
| `IDENTICAL_TIMESTAMPS` | CRITICAL | All answer timestamps identical (replay) |
| `ANSWER_BEFORE_QUESTION` | CRITICAL | Answer submitted before question was shown |
| `TOO_MANY_QUESTIONS` | HIGH | More questions answered than configured |
| `SESSION_TIME_BOUNDS` | CRITICAL | Total session duration exceeds maximum |
| `IDENTICAL_ANSWER_PATTERN` | MEDIUM | Same option selected every time |

---

## 10. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/games/quiz-rush/session` | Create session, get first question |
| POST | `/api/games/quiz-rush/session/:sessionId/answer` | Submit answer, get result + next question |
| POST | `/api/games/quiz-rush/session/:sessionId/complete` | Complete session, get final score |
| GET | `/api/games/quiz-rush/stats` | Get user's Quiz Rush statistics |
| GET | `/api/games/quiz-rush/leaderboard` | Get game-specific leaderboard |

---

## 11. Database Changes

### New tables added:

**`quiz_categories`** — Category definitions
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| slug | VARCHAR(64) | Unique slug |
| name | VARCHAR(128) | Display name |
| description | TEXT | Category description |
| is_active | BOOLEAN | Active status |
| sort_order | INTEGER | Display order |

**`quiz_questions`** — Question bank
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| version | INTEGER | Question version |
| category_id | UUID | FK to categories |
| difficulty | ENUM | easy/medium/hard |
| question | TEXT | Question text |
| correct_option_index | INTEGER | Index of correct option |
| explanation | TEXT | Post-answer explanation |
| time_limit_ms | INTEGER | Time limit per question |
| status | ENUM | draft/review/published/archived |
| is_active | BOOLEAN | Active status |

**`quiz_options`** — Answer options per question
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| question_id | UUID | FK to questions |
| option_index | INTEGER | Option position (0-3) |
| text | VARCHAR(512) | Option text |

**`quiz_answers`** — Per-session answer records
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | FK to game_sessions |
| question_id | UUID | FK to questions |
| question_version | INTEGER | Version at time of answer |
| selected_option_index | INTEGER | Player's choice |
| correct | BOOLEAN | Was answer correct |
| time_to_answer_ms | INTEGER | Time taken |
| score_earned | INTEGER | Score for this answer |
| streak | INTEGER | Streak at time of answer |
| sequence_number | INTEGER | Question order |

---

## 12. Content Management Foundation

Questions support a lifecycle: `DRAFT → REVIEW → PUBLISHED → ARCHIVED`

The schema supports:
- Category-based organization
- Difficulty levels (easy/medium/hard)
- Versioned questions (historical sessions remain valid)
- Explanation field for educational value
- Configurable time limits per question

---

## 13. Shared Systems Reused

| System | Package/Module |
|--------|---------------|
| Game Engine | `@gtx-rush/game-engine` (BaseGame, GameRegistry, AntiCheat) |
| Types | `@gtx-rush/types` (GameInput, GameResult) |
| Config | `@gtx-rush/config` (GAME_DEFINITIONS, ANTI_CHEAT_CONFIG) |
| UI Components | `@gtx-rush/ui` (GameHeader, GameLaunch, GameResult, Countdown) |
| Telegram | `@gtx-rush/telegram` (haptics, share, viewport) |

---

## 14. Analytics Events

| Event | Trigger |
|-------|---------|
| `quiz_game_opened` | Player opens Quiz Rush |
| `quiz_game_started` | Session created successfully |
| `quiz_question_shown` | Question displayed to player |
| `quiz_answer_submitted` | Player selects an answer |
| `quiz_correct` | Answer was correct |
| `quiz_incorrect` | Answer was incorrect |
| `quiz_timeout` | Time ran out for a question |
| `quiz_streak_started` | Streak reaches threshold |
| `quiz_streak_milestone` | Streak reaches 5, 10, 15+ |
| `quiz_game_completed` | All questions answered |
| `quiz_score_submitted` | Final score submitted |
| `quiz_personal_best` | New personal best achieved |
| `quiz_challenge_completed` | Friend challenge finished |
| `quiz_game_aborted` | Player exits before completion |

---

## 15. Configuration (No Magic Numbers)

All values centralized in `games/quiz-rush/src/config.ts`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `questionCount` | 10 | Questions per session |
| `defaultTimeLimitMs` | 15,000 | Time limit per question |
| `countdownDuration` | 3 | Countdown before start |
| `baseCorrectScore` | 500 | Points per correct answer |
| `easyScoreMultiplier` | 1.0 | Easy difficulty multiplier |
| `mediumScoreMultiplier` | 1.5 | Medium difficulty multiplier |
| `hardScoreMultiplier` | 2.0 | Hard difficulty multiplier |
| `speedBonusMaxPercent` | 0.5 | Max speed bonus (50% of base) |
| `streakBonusIncrement` | 0.1 | Streak multiplier increment |
| `streakBonusMax` | 2.0 | Maximum streak multiplier |
| `streakThreshold` | 2 | Streak before bonus activates |
| `minAnswerTimeMs` | 500 | Minimum valid answer time |
| `maxAnswerTimeMultiplier` | 1.5 | Max answer time vs time limit |

---

## 16. Known Limitations (MVP)

- Question bank is in-memory (27 questions across 8 categories). Production should use database.
- Daily Challenge and Friend Challenge are wired at the session level but full challenge orchestration follows existing patterns.
- Sound and haptic hooks are available through the Telegram abstraction but not yet triggered on all events.
- Answer review screen is basic; could be enhanced with animations.
- No admin dashboard for question management (schema foundation exists).
- Pause is supported in normal mode but disabled in competitive modes.

---

## 17. Confirmation: Previous Contracts Intact

- ✅ GTX Rush Architecture Contract v1.0 — Shared game engine, types, config, and database schema reused.
- ✅ GTX Rush UI/UX Contract v1.0 — Shared UI components reused. No new design system created.
- ✅ GTX Rush Telegram Integration Contract v1.0 — Telegram hooks available and wired.
- ✅ Reaction Rush Game Contract v1.0 — No changes to Reaction Rush code.
- ✅ Tap Rush Game Contract v1.0 — No changes to Tap Rush code.
