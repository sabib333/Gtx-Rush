/**
 * GTX Rush — Admin Games Management Page
 */

import { useState } from 'react';

interface Game {
  id: string; slug: string; name: string;
  status: 'enabled' | 'disabled' | 'maintenance';
  config: Record<string, unknown>; currentVersion: number;
}

const MOCK_GAMES: Game[] = [
  { id: 'game-reaction-rush', slug: 'reaction-rush', name: 'Reaction Rush', status: 'enabled', config: { rounds: 5, duration: 30000, difficulty: 'normal' }, currentVersion: 3 },
  { id: 'game-tap-rush', slug: 'tap-rush', name: 'Tap Rush', status: 'enabled', config: { duration: 10000, targetTaps: 100 }, currentVersion: 2 },
  { id: 'game-quiz-rush', slug: 'quiz-rush', name: 'Quiz Rush', status: 'enabled', config: { questions: 10, timePerQuestion: 15000 }, currentVersion: 1 },
];

export function Games() {
  const [games] = useState<Game[]>(MOCK_GAMES);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      enabled: 'bg-green-500/20 text-green-400',
      disabled: 'bg-red-500/20 text-red-400',
      maintenance: 'bg-yellow-500/20 text-yellow-400',
    };
    return colors[status] ?? 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Game Management</h1>
        <p className="text-gray-500 text-sm mt-1">Configure and manage game settings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {games.map((game) => (
          <div
            key={game.id}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-700 transition-colors"
            onClick={() => setSelectedGame(game)}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">{game.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(game.status)}`}>
                {game.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Version: {game.currentVersion}</div>
              <div>Config: {Object.keys(game.config).join(', ')}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Game Config Modal */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedGame.name}</h2>
                <p className="text-sm text-gray-500">v{selectedGame.currentVersion} · {selectedGame.status}</p>
              </div>
              <button onClick={() => setSelectedGame(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Current Configuration</h3>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(selectedGame.config, null, 2)}
              </pre>
            </div>

            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-600/30">
                Enable
              </button>
              <button className="px-3 py-1.5 bg-yellow-600/20 text-yellow-400 rounded-lg text-xs font-medium hover:bg-yellow-600/30">
                Maintenance
              </button>
              <button className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-600/30">
                Disable
              </button>
              <button className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-600/30">
                Edit Config
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
