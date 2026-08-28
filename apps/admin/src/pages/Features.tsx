/**
 * GTX Rush — Admin Feature Flags Page
 */

import { useState } from 'react';

interface FeatureFlag {
  id: string; name: string; displayName: string; status: string;
  rolloutPercentage: number; description: string;
}

const MOCK_FLAGS: FeatureFlag[] = [
  { id: 'ff-001', name: 'new_home', displayName: 'New Home Screen', status: 'active', rolloutPercentage: 25, description: 'Redesigned home screen layout' },
  { id: 'ff-002', name: 'creator_engine', displayName: 'Creator Engine', status: 'active', rolloutPercentage: 100, description: 'UGC challenge creation system' },
  { id: 'ff-003', name: 'smart_recommendations', displayName: 'Smart Recommendations', status: 'active', rolloutPercentage: 50, description: 'AI-powered game recommendations' },
  { id: 'ff-004', name: 'team_events', displayName: 'Team Events', status: 'draft', rolloutPercentage: 0, description: 'Team-based competitive events' },
  { id: 'ff-005', name: 'new_store', displayName: 'New Store', status: 'inactive', rolloutPercentage: 0, description: 'Redesigned cosmetic store' },
];

export function Features() {
  const [flags] = useState<FeatureFlag[]>(MOCK_FLAGS);

  const statusColor = (s: string) => ({
    active: 'bg-green-500/20 text-green-400',
    inactive: 'bg-gray-500/20 text-gray-400',
    draft: 'bg-yellow-500/20 text-yellow-400',
  }[s] ?? 'bg-gray-500/20 text-gray-400');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🚩 Feature Flags</h1>
          <p className="text-gray-500 text-sm mt-1">Manage feature flags and gradual rollouts</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
          + New Flag
        </button>
      </div>

      <div className="space-y-3">
        {flags.map((flag) => (
          <div key={flag.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm">{flag.displayName}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColor(flag.status)}`}>
                    {flag.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{flag.description}</p>
                <p className="text-xs text-gray-600 mt-0.5">Flag: <code className="text-gray-400">{flag.name}</code></p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-gray-500">Rollout</div>
                <div className="text-sm font-bold text-white">{flag.rolloutPercentage}%</div>
              </div>
              <div className="w-32 bg-gray-800 rounded-full h-2">
                <div
                  className={`rounded-full h-2 ${flag.status === 'active' ? 'bg-green-500' : 'bg-gray-600'}`}
                  style={{ width: `${flag.rolloutPercentage}%` }}
                />
              </div>
              <div className="flex gap-1">
                {flag.status === 'active' ? (
                  <button className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs">Disable</button>
                ) : (
                  <button className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">Enable</button>
                )}
                <button className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Edit</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
