import { GameCard } from '@gtx-rush/ui';

const games = [
  {
    slug: 'reaction-rush',
    name: 'Reaction Rush',
    icon: '⚡',
    color: 'reaction' as const,
    description: 'Test your reflexes! React as fast as you can.',
    bestScore: 9420,
    globalRank: 2481,
    isPopular: true,
  },
  {
    slug: 'tap-rush',
    name: 'Tap Rush',
    icon: '👆',
    color: 'tap' as const,
    description: 'Tap targets as fast and accurately as you can!',
    bestScore: 7850,
    globalRank: 3102,
  },
  {
    slug: 'quiz-rush',
    name: 'Quiz Rush',
    icon: '🧠',
    color: 'quiz' as const,
    description: 'Answer questions fast to beat your opponents!',
    bestScore: 6200,
    globalRank: 1895,
  },
];

export function Games() {
  return (
    <div className="page-container">
      <h1 className="text-h1 font-display text-white mb-6 animate-fade-in">Games</h1>

      <div className="space-y-4 animate-slide-up">
        {games.map((game, i) => (
          <GameCard
            key={game.slug}
            {...game}
            onClick={() => {}}
          />
        ))}
      </div>

      {/* Coming Soon hint */}
      <div className="mt-8 text-center animate-fade-in" style={{ animationDelay: '200ms' }}>
        <p className="text-caption text-txt-tertiary">More games coming soon!</p>
      </div>
    </div>
  );
}
