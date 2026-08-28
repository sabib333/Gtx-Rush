/**
 * GTX Rush — Admin Analytics Center Page
 */

import { useState } from 'react';

type Tab = 'overview' | 'funnel' | 'cohorts' | 'social' | 'creators' | 'personalization';

export function Analytics() {
  const [tab, setTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'funnel', label: 'Funnel', icon: '🔽' },
    { id: 'cohorts', label: 'Cohorts', icon: '👥' },
    { id: 'social', label: 'Social', icon: '🤝' },
    { id: 'creators', label: 'Creators', icon: '🎨' },
    { id: 'personalization', label: 'AI', icon: '🤖' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">📈 Analytics Center</h1>
        <p className="text-gray-500 text-sm mt-1">Platform analytics and insights</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card title="DAU" value="12,500" />
          <Card title="WAU" value="45,000" />
          <Card title="MAU" value="180,000" />
          <Card title="D1 Retention" value="45%" />
          <Card title="D7 Retention" value="28%" />
          <Card title="D30 Retention" value="15%" />
          <Card title="Sessions/User" value="3.2" />
          <Card title="Games/User" value="5.8" />
          <Card title="Challenges/User" value="1.4" />
          <Card title="Events/User" value="0.8" />
          <Card title="Friends/User" value="2.1" />
          <Card title="Teams/User" value="0.6" />
        </div>
      )}

      {tab === 'funnel' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">User Funnel</h2>
          <div className="space-y-3">
            {[
              { name: 'Telegram Entry', count: 100000, rate: 100 },
              { name: 'Mini App Open', count: 65000, rate: 65 },
              { name: 'First Game', count: 45000, rate: 69 },
              { name: 'Second Game', count: 32000, rate: 71 },
              { name: 'Challenge Created', count: 18000, rate: 56 },
              { name: 'Team Joined', count: 8000, rate: 44 },
              { name: 'Event Participation', count: 12000, rate: 67 },
              { name: 'Return (D7)', count: 12600, rate: 28 },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-40 text-sm text-gray-300">{step.name}</div>
                <div className="flex-1 bg-gray-800 rounded-full h-6 relative">
                  <div
                    className="bg-blue-500/60 rounded-full h-6 flex items-center justify-end pr-2"
                    style={{ width: `${step.rate}%` }}
                  >
                    <span className="text-xs text-white font-medium">{step.count.toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-12 text-xs text-gray-500 text-right">{step.rate}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'cohorts' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Cohort</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Size</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">D1</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">D7</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">D30</th>
              </tr>
            </thead>
            <tbody>
              {[
                { date: '2024-08-01', size: 2500, d1: 48, d7: 30, d30: 16 },
                { date: '2024-07-01', size: 2200, d1: 45, d7: 27, d30: 14 },
                { date: '2024-06-01', size: 1800, d1: 42, d7: 25, d30: 12 },
              ].map((c, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td className="px-4 py-2 text-sm text-white">{c.date}</td>
                  <td className="px-4 py-2 text-sm text-gray-400">{c.size.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-green-400">{c.d1}%</td>
                  <td className="px-4 py-2 text-sm text-yellow-400">{c.d7}%</td>
                  <td className="px-4 py-2 text-sm text-orange-400">{c.d30}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'social' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card title="Friend Connections" value="45,000" />
          <Card title="Challenges Sent" value="28,000" />
          <Card title="Challenges Completed" value="22,000" />
          <Card title="Team Joins" value="8,500" />
          <Card title="Team Events" value="3,200" />
          <Card title="Social Retention (w/ friends)" value="38%" />
          <Card title="Social Retention (no friends)" value="18%" />
        </div>
      )}

      {tab === 'creators' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card title="Active Creators" value="320" />
          <Card title="Challenges Created" value="1,200" />
          <Card title="Challenge Plays" value="45,000" />
          <Card title="Completion Rate" value="68%" />
          <Card title="Creator Retention (Weekly)" value="72%" />
          <Card title="Creator Retention (Monthly)" value="55%" />
        </div>
      )}

      {tab === 'personalization' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card title="Recommendation CTR" value="32%" />
          <Card title="Completion" value="58%" />
          <Card title="Dismissal" value="12%" />
          <Card title="Retention Impact" value="+8%" />
        </div>
      )}
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}
