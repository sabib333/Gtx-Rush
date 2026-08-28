import { Link } from 'react-router-dom';
import { Card, XPBar, GameCard, ChallengeCard, Badge } from '@gtx-rush/ui';

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

export function Home() {
  return (
    <div className="page-container">
      {/* User Progress Section */}
      <div className="mb-6 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-h2 font-display text-white">Welcome back!</h2>
            <p className="text-body-sm text-txt-secondary">Level 1 • Rookie</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm">🔥</span>
            <span className="text-body font-bold text-warning-400 tabular-nums">0</span>
          </div>
        </div>
        <XPBar currentXP={0} nextLevelXP={100} level={1} />
      </div>

      {/* Daily Challenge - Hero Card */}
      <div className="mb-6 animate-slide-up">
        <ChallengeCard
          type="daily"
          title="Beat the Clock"
          gameName="Reaction Rush"
          gameIcon="⚡"
          timer="12:48:20"
          attempts={{ used: 0, total: 3 }}
          status="active"
          reward="⚡ +50 XP"
          onPlay={() => {}}
        />
      </div>

      {/* Quick Games */}
      <div className="mb-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <h3 className="section-heading">
          <span>🎮</span> Quick Play
        </h3>
        <div className="space-y-3">
          {games.map((game) => (
            <GameCard
              key={game.slug}
              {...game}
              onClick={() => {}}
            />
          ))}
        </div>
      </div>

      {/* Current Rank */}
      <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
        <h3 className="section-heading">
          <span>🏆</span> Your Rank
        </h3>
        <Card glow>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent-500/15 flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <div>
                <div className="text-body-sm text-txt-secondary">Global Rank</div>
                <div className="text-score-sm font-score text-white tabular-nums">#2,481</div>
              </div>
            </div>
            <Link
              to="/leaderboard"
              className="btn-ghost text-accent-400"
            >
              View All →
            </Link>
          </div>
        </Card>
      </div>

      {/* Friend Activity */}
      <div className="mt-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
        <h3 className="section-heading">
          <span>👥</span> Friend Activity
        </h3>
        <Card>
          <div className="text-center py-4">
            <p className="text-body-sm text-txt-secondary mb-3">
              Challenge your friends to beat your score!
            </p>
            <Link to="/profile" className="btn-secondary text-sm">
              📤 Invite Friends
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
