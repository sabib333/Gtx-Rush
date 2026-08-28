/**
 * GTX Rush — Admin Experiments (A/B Testing) Page
 */

import { useState } from 'react';

interface Experiment {
  id: string; name: string; status: string; targetMetric: string;
  hypothesis: string; createdAt: string;
}

const MOCK_EXPERIMENTS: Experiment[] = [
  { id: 'exp-001', name: 'Smart Director v2', status: 'completed', targetMetric: 'games_per_session', hypothesis: 'Increase games per session by 10%', createdAt: '2024-06-25' },
  { id: 'exp-002', name: 'New Home Layout', status: 'running', targetMetric: 'first_game_rate', hypothesis: 'Increase first game rate by 5%', createdAt: '2024-08-10' },
];

export function Experiments() {
  const [experiments] = useState<Experiment[]>(MOCK_EXPERIMENTS);

  const statusColor = (s: string) => ({
    draft: 'bg-gray-500/20 text-gray-400',
    running: 'bg-green-500/20 text-green-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-blue-500/20 text-blue-400',
  }[s] ?? 'bg-gray-500/20 text-gray-400');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🧪 A/B Testing</h1>
          <p className="text-gray-500 text-sm mt-1">Manage experiments and variants</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
          + New Experiment
        </button>
      </div>

      <div className="space-y-4">
        {experiments.map((exp) => (
          <div key={exp.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-white">{exp.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{exp.hypothesis}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${statusColor(exp.status)}`}>
                {exp.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Metric: {exp.targetMetric}</span>
              <span>Created: {exp.createdAt}</span>
            </div>
            {exp.status === 'completed' && (
              <div className="mt-3 bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500">Result: Variant A won with +12% lift (95% confidence)</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
