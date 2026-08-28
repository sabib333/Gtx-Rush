/**
 * GTX Rush — Admin Leaderboards Page
 */

export function Leaderboards() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🥇 Leaderboards</h1>
        <p className="text-gray-500 text-sm mt-1">Inspect and manage leaderboards</p>
      </div>

      {/* Leaderboard List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { id: 'lb-global', name: 'Global Leaderboard', type: 'global', entries: 15000, active: true },
          { id: 'lb-weekly', name: 'Weekly Leaderboard', type: 'weekly', entries: 8000, active: true },
          { id: 'lb-reaction', name: 'Reaction Rush Top', type: 'game_specific', entries: 5000, active: true },
        ].map((lb) => (
          <div key={lb.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white">{lb.name}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                {lb.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-xs text-gray-500">{lb.type} · {lb.entries.toLocaleString()} entries</div>
          </div>
        ))}
      </div>

      {/* Top Entries */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Global Leaderboard — Top 10</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase w-16">Rank</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Player</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Score</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Flags</th>
              <th className="text-right px-4 py-2 text-xs text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }, (_, i) => ({
              rank: i + 1, name: `Player ${i + 1}`, score: 10000 - i * 200, flags: i === 5 ? 1 : 0,
            })).map((entry) => (
              <tr key={entry.rank} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-2 text-sm font-bold text-white">#{entry.rank}</td>
                <td className="px-4 py-2 text-sm text-gray-300">{entry.name}</td>
                <td className="px-4 py-2 text-sm text-gray-300">{entry.score.toLocaleString()}</td>
                <td className="px-4 py-2">
                  {entry.flags > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">{entry.flags} flag</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button className="text-xs text-blue-400 hover:text-blue-300">Inspect</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
