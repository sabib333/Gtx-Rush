/**
 * GTX Rush — AI Personalization & Smart Game Director Engine Types
 *
 * Handles:
 * - Player preference tracking
 * - Skill estimation
 * - Smart recommendations
 * - Goal system
 * - Adaptive difficulty
 * - A/B testing
 *
 * Contract: AI Personalization Contract v1.0
 */

// ============================================================
// Game Types
// ============================================================

export type GameId = 'reaction-rush' | 'tap-rush' | 'quiz-rush';

export type SkillBand = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'elite';

export type EngagementLevel = 'inactive' | 'returning' | 'active' | 'power';

export type GoalType =
  | 'reach_rank'
  | 'get_personal_best'
  | 'maintain_streak'
  | 'win_challenges'
  | 'complete_missions'
  | 'play_games'
  | 'join_events';

export type GoalStatus = 'active' | 'completed' | 'failed' | 'abandoned';

export type ExperimentStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled';

export type RecommendationType =
  | 'game'
  | 'daily_rush'
  | 'mission'
  | 'event'
  | 'challenge'
  | 'team'
  | 'cosmetic'
  | 'store'
  | 'social'
  | 'goal';

// ============================================================
// Player Profile
// ============================================================

export interface GamePreference {
  gameId: GameId;
  preferenceScore: number; // 0-100
  gamesPlayed: number;
  gamesCompleted: number;
  repeatSessions: number;
  personalBestAttempts: number;
  eventParticipation: number;
  averageScore: number;
  bestScore: number;
  lastPlayed: Date | null;
}

export interface SkillEstimate {
  gameId: GameId;
  skillScore: number; // 0-100
  skillBand: SkillBand;
  gamesPlayed: number;
  averagePerformance: number;
  recentPerformance: number;
  improvementRate: number;
  lastUpdated: Date;
}

export interface PlayerPreferenceProfile {
  userId: string;
  primaryGame: GameId | null;
  secondaryGame: GameId | null;
  gamePreferences: GamePreference[];
  skillEstimates: SkillEstimate[];
  averageSessionLength: number; // minutes
  gamesPerSession: number;
  preferredPlayTime: string | null; // HH:MM format
  missionCompletionRate: number;
  eventParticipationRate: number;
  challengeActivity: number;
  socialActivity: number;
  engagementLevel: EngagementLevel;
  lastActive: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Recommendations
// ============================================================

export interface RecommendationCandidate {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  reason: string;
  gameId: GameId | null;
  eventId: string | null;
  missionId: string | null;
  score: number;
  metadata: Record<string, unknown>;
}

export interface RecommendationScore {
  preference: number; // 0-1
  recency: number; // 0-1
  difficultyFit: number; // 0-1
  socialRelevance: number; // 0-1
  eventUrgency: number; // 0-1
  goalRelevance: number; // 0-1
  exploration: number; // 0-1
}

export interface HomeRecommendations {
  recommendations: RecommendationCandidate[];
  personalBestCoach: PersonalBestCoach | null;
  smartPlan: SmartDailyPlan | null;
  welcomeMessage: string;
}

export interface PersonalBestCoach {
  gameId: GameId;
  currentScore: number;
  previousBest: number;
  isNewBest: boolean;
  percentImprovement: number;
  message: string;
}

export interface SmartDailyPlan {
  tasks: SmartPlanTask[];
  estimatedTimeMinutes: number;
  completionPercentage: number;
}

export interface SmartPlanTask {
  id: string;
  type: 'mission' | 'event' | 'challenge' | 'game';
  title: string;
  description: string;
  completed: boolean;
  estimatedMinutes: number;
}

// ============================================================
// Goals
// ============================================================

export interface PlayerGoal {
  id: string;
  userId: string;
  type: GoalType;
  title: string;
  description: string;
  target: number;
  current: number;
  status: GoalStatus;
  source: 'system' | 'user';
  createdAt: Date;
  completedAt: Date | null;
}

export interface GoalProgress {
  goalId: string;
  current: number;
  target: number;
  percentage: number;
  remaining: number;
  isComplete: boolean;
}

// ============================================================
// Adaptive Difficulty
// ============================================================

export interface AdaptiveDifficultyConfig {
  gameId: GameId;
  enabled: boolean;
  practiceMode: boolean;
  difficultyAdjustments: DifficultyAdjustment[];
}

export interface DifficultyAdjustment {
  skillBand: SkillBand;
  timingMultiplier: number;
  targetMultiplier: number;
  comboMultiplier: number;
  description: string;
}

// ============================================================
// A/B Testing
// ============================================================

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  targetMetric: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number; // 0-1
  config: Record<string, unknown>;
}

export interface ExperimentAssignment {
  userId: string;
  experimentId: string;
  variantId: string;
  assignedAt: Date;
}

// ============================================================
// Engagement Tracking
// ============================================================

export interface EngagementMetrics {
  userId: string;
  dailyActiveDays: number;
  weeklyActiveDays: number;
  monthlyActiveDays: number;
  averageSessionLength: number;
  gamesPerSession: number;
  lastSessionDate: Date;
  streakDays: number;
  engagementLevel: EngagementLevel;
}

// ============================================================
// API Responses
// ============================================================

export interface PersonalizationHomeResponse {
  success: boolean;
  data: {
    recommendations: RecommendationCandidate[];
    personalBestCoach: PersonalBestCoach | null;
    smartPlan: SmartDailyPlan | null;
    welcomeMessage: string;
    engagementLevel: EngagementLevel;
  };
}

export interface PlayerProfileResponse {
  success: boolean;
  data: {
    profile: PlayerPreferenceProfile;
    topRecommendations: RecommendationCandidate[];
    activeGoals: PlayerGoal[];
  };
}

export interface GoalResponse {
  success: boolean;
  data: {
    goals: PlayerGoal[];
    progress: GoalProgress[];
  };
}

export interface GoalCreateRequest {
  type: GoalType;
  target: number;
  title?: string;
  description?: string;
}

export interface RecommendationTrackRequest {
  recommendationId: string;
  action: 'shown' | 'clicked' | 'completed' | 'dismissed';
}
