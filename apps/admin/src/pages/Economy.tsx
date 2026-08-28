/**
 * GTX Rush — Admin Economy Operations Page
 */

export function Economy() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">💰 Economy Operations</h1>
        <p className="text-gray-500 text-sm mt-1">Inspect transactions, rewards, and economy health</p>
      </div>

      {/* Economy Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Daily XP Issued</div>
          <div className="text-xl font-bold text-white">250K</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Daily Rewards</div>
          <div className="text-xl font-bold text-white">1,200</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Outstanding XP</div>
          <div className="text-xl font-bold text-white">15M</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Anomalies</div>
          <div className="text-xl font-bold text-yellow-400">2</div>
        </div>
      </div>

      {/* Top XP Sources */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Top XP Sources</h2>
        <div className="space-y-2">
          {[
            { source: 'game_play', amount: 150000, pct: 60 },
            { source: 'daily_challenge', amount: 50000, pct: 20 },
            { source: 'achievements', amount: 30000, pct: 12 },
            { source: 'streak_bonus', amount: 20000, pct: 8 },
          ].map((s) => (
            <div key={s.source} className="flex items-center gap-3">
              <div className="w-32 text-sm text-gray-300">{s.source}</div>
              <div className="flex-1 bg-gray-800 rounded-full h-2">
                <div className="bg-blue-500 rounded-full h-2" style={{ width: `${s.pct}%` }} />
              </div>
              <div className="w-20 text-sm text-gray-400 text-right">{(s.amount / 1000).toFixed(0)}K</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Transactions</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">ID</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">User</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Amount</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Source</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: 'txn-001', user: 'usr-001', amount: 150, source: 'game_play', date: '2024-08-20' },
              { id: 'txn-002', user: 'usr-002', amount: 50, source: 'daily_challenge', date: '2024-08-20' },
              { id: 'txn-003', user: 'usr-003', amount: 200, source: 'achievement', date: '2024-08-20' },
            ].map((t) => (
              <tr key={t.id} className="border-b border-gray-800/50">
                <td className="px-4 py-2 text-sm text-gray-400">{t.id}</td>
                <td className="px-4 py-2 text-sm text-white">{t.user}</td>
                <td className="px-4 py-2 text-sm text-green-400">+{t.amount} XP</td>
                <td className="px-4 py-2 text-sm text-gray-400">{t.source}</td>
                <td className="px-4 py-2 text-sm text-gray-500">{t.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reward Adjustment */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mt-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Reward Adjustment</h2>
        <p className="text-xs text-gray-500 mb-3">Create a formal reward adjustment (requires reason and evidence)</p>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="User ID" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          <input type="number" placeholder="Adjustment amount" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          <input placeholder="Reason (required)" className="col-span-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        </div>
        <button className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
          Create Adjustment
        </button>
      </div>
    </div>
  );
}
