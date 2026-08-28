export interface ReactionRushInput {
  type: 'reaction';
  data: {
    reactionTimeMs: number;
    roundNumber: number;
  };
}

export interface ReactionRushResult {
  score: number;
  averageReactionTime: number;
  bestReactionTime: number;
  roundsCompleted: number;
  rounds: {
    roundNumber: number;
    reactionTimeMs: number;
    color: string;
  }[];
}
