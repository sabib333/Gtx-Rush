/**
 * GTX Rush — Admin Moderation Center Page
 */

import { useState } from 'react';

interface ModCase {
  id: string; caseNumber: number; targetType: string;
  reason: string; status: string; priority: number; createdAt: string;
}

const MOCK_MOD: ModCase[] = [
  { id: 'mc-001', caseNumber: 1, targetType: 'challenge', reason: 'Inappropriate challenge title', status: 'new', priority: 1, createdAt: '2024-08-20' },
  { id: 'mc-002', caseNumber: 2, targetType: 'profile', reason: 'Spam in profile bio', status: 'reviewing', priority: 2, createdAt: '2024-08-19' },
];

export function Moderation() {
  const [cases] = useState<ModCase[]>(MOCK_MOD);
  const [selectedCase, setSelectedCase] = useState<ModCase | null>(null);

  const statusColor = (s: string) => ({
    new: 'bg-blue-500/20 text-blue-400',
    reviewing: 'bg-yellow-500/20 text-yellow-400',
    action_taken: 'bg-orange-500/20 text-orange-400',
    resolved: 'bg-green-500/20 text-green-400',
  }[s] ?? 'bg-gray-500/20 text-gray-400');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🛡 Moderation Center</h1>
        <p className="text-gray-500 text-sm mt-1">Review reports and moderate content</p>
      </div>

      {/* Queue Summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">New</div>
          <div className="text-xl font-bold text-blue-400">{cases.filter(c => c.status === 'new').length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Reviewing</div>
          <div className="text-xl font-bold text-yellow-400">{cases.filter(c => c.status === 'reviewing').length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Action Taken</div>
          <div className="text-xl font-bold text-orange-400">{cases.filter(c => c.status === 'action_taken').length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Resolved</div>
          <div className="text-xl font-bold text-green-400">{cases.filter(c => c.status === 'resolved').length}</div>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Case</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Reason</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Priority</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-sm text-white">#{c.caseNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{c.targetType}</td>
                <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">{c.reason}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColor(c.status)}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">{c.priority}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setSelectedCase(c)} className="text-xs text-blue-400 hover:text-blue-300">Review</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCase && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold text-white">Case #{selectedCase.caseNumber}</h2>
              <button onClick={() => setSelectedCase(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <p className="text-sm text-gray-300 mb-4">{selectedCase.reason}</p>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-gray-600/20 text-gray-400 rounded-lg text-xs font-medium">No Action</button>
              <button className="px-3 py-1.5 bg-yellow-600/20 text-yellow-400 rounded-lg text-xs font-medium">Warning</button>
              <button className="px-3 py-1.5 bg-orange-600/20 text-orange-400 rounded-lg text-xs font-medium">Remove Content</button>
              <button className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs font-medium">Suspend User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
