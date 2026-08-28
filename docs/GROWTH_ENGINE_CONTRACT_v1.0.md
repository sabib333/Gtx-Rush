# GTX Rush — Viral Growth Engine Contract v1.0

> **PLAY + COMPETE + SHARE + INVITE + GROW**
>
> The product is the marketing engine. Growth is earned through product value,
> never bought with spam, and always measured by retention quality.

---

## 1. Purpose & Scope

The Viral Growth Engine turns every meaningful player moment into an
opportunity for organic network expansion:

```
PLAY → GET SCORE → CHALLENGE FRIEND → FRIEND OPENS → FRIEND PLAYS
     → FRIEND GETS SCORE → FRIEND CHALLENGES ANOTHER PERSON → NETWORK EXPANDS
```

Growth philosophy (in priority order):

1. **Product-led growth** — the game must be worth sharing on its own.
2. **Social competition** — challenges, leaderboards, teams, events.
3. **Shareable moments** — scores, ranks, achievements, milestones.
4. **Referrals** — rewarded only for genuine new-player quality.
5. **Creator content** — creator challenges as evergreen acquisition loops.

Paid advertising may be layered on later, but it is never a dependency and
must always be measured separately from organic growth (§15).

---

## 2. Measurable Growth Loops

Every loop MUST define Trigger, Action, Conversion, Reward (where appropriate),
and Measurement. Implemented loops:

| Loop            | Trigger                  | Action                    | Conversion              | Reward             | Measurement                          |
|-----------------|--------------------------|---------------------------|-------------------------|--------------------|--------------------------------------|
| Challenge Loop  | Strong score / result    | Send challenge            | Recipient plays         | Social standing    | `share_challenge`, challenge funnel  |
| Referral Loop   | Invite Center CTA        | Share invite link         | Invitee qualifies       | XP / badge / frame | `referral_*` events, K-factor        |
| Team Loop       | Team creation            | Share team invite         | Friend joins team       | Cosmetic / XP      | `share_team_invite` events           |
| Creator Loop    | Challenge published      | Share creator challenge   | Plays + follows         | Audience growth    | `share_creator_challenge` events     |
| Leaderboard Loop| Rank visibility          | [CHALLENGE FRIEND] / share rank | Friend plays       | Position defense   | `share_rank`, rank-share conversion  |
| Event Loop      | Event live               | Join + share position     | Friend joins event      | Ticket / cosmetic  | `share_event`, event attribution     |
| Achievement Loop| Milestone unlocked       | Optional share            | New user opens          | None required      | `share_badge` etc.                   |
| Share Loop      | Post-game result screen  | Optional share            | Deep link open          | None               | All `share_*` events                 |

Sharing is ALWAYS optional. Sharing is never forced, never rewarded per click,
and messages are never misleading or humiliating.

---

## 3. Referral System Rules

1. Every user gets exactly one active referral code (`referral-engine.ts`).
2. Codes are non-sensitive, unguessable, and validated server-side.
3. Referral lifecycle:
   `created → opened → registered → activated → qualified → rewarded`
   with terminal state `rejected` for fraud/self-referral.
4. Statuses align to attribution reporting: CLICKED (opened), STARTED
   (registered), QUALIFIED, REWARDED, REJECTED.
5. A referral is attributed only when the server resolves a valid deep link —
   client-supplied `referrer_id` / `campaign_id` / reward status are never trusted.

### 3.1 Qualification (§4 of spec)

A referral qualifies ONLY after meaningful activity, configured in
`QUALIFICATION_CONFIG`:

- Strategy: `first_game_completed` | `games_completed` | `minimum_activity` | `event_joined`
- `requiredGamesCompleted` — legitimate completions needed (default 1)
- `minimumValidScore` — completions below this score do not count
- `minSecondsBetweenGames` — anti-automation spacing between counted games
- `eventJoinQualifies` — joining an event can qualify when enabled
- `qualificationWindowHours` — time limit after first activity

Link clicks NEVER qualify. Fake engagement (impossible scores, machine-gun
completions) does not count toward thresholds.

### 3.2 Rewards

- Rewards flow: Qualified → Fraud Check → Campaign Budget Check → Economy
  Engine transaction → Grant. The engine NEVER edits user XP directly;
  all value passes through `economy-service.awardXP` /
  `createRewardTransaction` with idempotency keys.
- Rewards: capped XP, milestone badges, cosmetics, frames. No cash,
  no "guaranteed earnings", no unlimited high-value payouts.
- Both inviter and invitee may receive rewards; both are idempotent.

### 3.3 Caps & Budgets

- Per-user referral limits: daily qualified cap, total rewardable cap,
  monthly reward cap (`REFERRAL_LIMITS`).
- Campaign budgets (`CAMPAIGN_BUDGET_DEFAULTS`, per-campaign overrides):
  - `rewardBudgetXP` — total spend ceiling
  - `dailyCapXP` — per-day spend ceiling
  - `userCap` — rewards per user across the campaign
  - `totalUserCap` — distinct rewarded users ceiling
- When ANY budget cap is reached, the campaign STOPS REWARDING but keeps
  collecting analytics. Qualification still stands; only payout stops.

### 3.4 Anti-Fraud

Integrated signals: self-referral (hard reject), rapid account creation,
abnormal referral velocity, suspicious patterns (`FRAUD_CONFIG`). Risk-scored
with approve/hold/reject recommendations. One weak signal never permanently
bans a user. Fraudulent acquisitions feed the source fraud rate and reduce
source quality scores (§5).

---

## 4. Sharing & Deep Links

- Shareable objects: challenge, score, personal best, badge/achievement,
  leaderboard rank (server-generated only), event position, team invite,
  creator challenge, daily rush.
- Every share carries one clear CTA. Win/loss language is friendly
  ("You got me this time 🔥"), never toxic or humiliating.
- Telegram deep links (`t.me/<bot>?start=...`) use typed prefixes:
  `ref_` referral, `ch_` challenge, `camp_` campaign, `team_` team,
  `event_` event. All parameters are validated server-side on resolution;
  invalid or expired links resolve to a safe default experience.
- Contextual landing: "Alex challenged you! [ACCEPT CHALLENGE]" — never a
  generic page. Deferred context survives onboarding.
- Share previews show honest metadata ("GTX Rush ⚡ Can you beat this score?").

---

## 5. Analytics & Quality Measurement

- **Funnel**: Telegram Entry → Mini App Open → First Game → First Win →
  First Share → Friend Opens → Friend Plays → Friend Returns. Every step emits
  an analytics event.
- **K-factor**: `invites per active user × invite-to-qualified conversion`,
  tracked daily via `growth-cohorts.getKFactorTrend`. K-factor is a health
  signal, not a revenue guarantee.
- **Retention**: D1/D7/D30 measured PER acquisition source. High-retention
  growth always beats low-quality viral traffic.
- **Source Quality Score** (0–100): weighted composite of activation rate,
  D1/D7 retention, engagement, fraud penalty, monetization. Sources are ranked
  by quality-adjusted growth — never by raw volume.
- Attribution sources: organic, referral, challenge, team, creator, event,
  campaign. Uncertain attribution stays organic; paid and organic are never
  mixed.
- The growth dashboard surfaces fraud alongside growth (referral fraud,
  campaign abuse, reward abuse) — growth teams cannot ignore fraud.

---

## 6. Notifications & Re-engagement

- Notification triggers: friend challenged you, challenge result, team event
  starting, event ending soon, followed-creator published.
- Hard throttles enforced server-side (`notification-throttle.ts`): per-hour,
  per-day, per-category caps. User preferences always override triggers.
- Re-engagement messages (Day 1/3/7) send ONLY when genuinely relevant
  ("Your team is competing tonight ⚡"). No deceptive urgency, no spam.

---

## 7. Experiments

Every growth experiment MUST declare hypothesis, variants (weighted),
target metric, and duration (`growth-experiments.ts`). Assignment is
deterministic per user. Winners require experiment completion plus minimum
sample per arm. Unassigned users are never counted in results.

---

## 8. Non-Negotiable Rules

1. Growth must be driven primarily by product value.
2. Referrals require meaningful user activity.
3. Self-referrals are invalid.
4. Referral rewards are capped.
5. Every attribution is server-validated.
6. Deep links are validated server-side.
7. Sharing is optional.
8. Spam is never a growth strategy.
9. New-user quality matters more than raw acquisition.
10. Retention must be measured for every major growth source.
11. Creator, Team, Challenge, and Event systems contribute to the same
    growth architecture.
12. Growth rewards must use the Economy Engine.
13. Fraud detection must be integrated into referral rewards.
14. Growth campaigns must have configurable budgets and limits.
15. Paid acquisition and organic acquisition remain measurable separately.
16. Every growth experiment must have a measurable hypothesis.

Explicitly forbidden: spam incentives, fake engagement, guaranteed earnings,
paid referral pyramids, multi-level recruitment commissions, self-referral
rewards, unlimited referral rewards, misleading share messages, forced sharing,
deceptive notifications, purchased ranking for creators.

---

## 9. Module Map

| Module                              | Responsibility                                        |
|-------------------------------------|-------------------------------------------------------|
| `services/referral-engine.ts`       | Codes, lifecycle, fraud checks, reward records        |
| `services/qualification-engine.ts`  | Meaningful-activity qualification pipeline            |
| `services/campaign-service.ts`      | Campaigns + budget controls                           |
| `services/share-engine.ts`          | Share links, messages, deep-link generation           |
| `services/growth-analytics.ts`      | Growth events, funnel metrics                         |
| `services/growth-cohorts.ts`        | Cohort retention, quality scores, K-factor trends     |
| `services/growth-experiments.ts`    | A/B experiments with deterministic assignment         |
| `services/notification-throttle.ts` | Frequency caps and preference enforcement             |
| `routes/growth.ts`                  | Public API surface                                    |
| `packages/config/src/growth.ts`     | All thresholds and templates (version-controlled)     |
| `packages/types/src/growth.ts`      | Contract types                                        |

---

## 10. Success Condition

```
1 USER → 1+ INVITES → NEW USERS → NEW USERS INVITE OTHERS → ORGANIC NETWORK EFFECT
```

while creators gain followers from shared challenges, teams recruit through
competition, and events convert rankings into invitations — with retention
quality improving, not degrading, as the network grows.

**GTX Rush — Viral Growth Engine Contract v1.0**
