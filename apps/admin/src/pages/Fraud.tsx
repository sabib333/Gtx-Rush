/**
 * GTX Rush — Admin Fraud Center Page
 */

import { useState } from 'react';

interface FraudCase {
  id: string; caseNumber: number; userId: string; username: string;
  flagType: string; severity: string; status: string; createdAt: string;
}

const MOCK_FRAUD: FraudCase[] = [
  { id: 'fc-001', caseNumber: 1, userId: 'usr-004', username: 'suspicious_user', flagType: 'impossible_score', severity: 'high', status: 'detected', createdAt: '2024-08-20' },
  { id: 'fc-002', caseNumber: 2, userId: 'usr-005', username: 'bot_player', flagType: 'bot_behavior', severity: 'critical', status: 'reviewing', createdAt: '2024-08-19' },
  { id: 'fc-003', caseNumber: 3, userId: 'usr-006', username: 'referral_abuser', flagType: 'referral_abuse', severity: 'medium', status: 'detected', createdAt: '2024-08-18' },
];

export function Fraud() {
  const [cases] = useState<FraudCase[]>(MOCK_FRAUD);
  const [selectedCase, setSelectedCase] = useState<FraudCase | null>(null);

  const severityColor = (s: string) => ({
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-orange-500/20 text-orange-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-gray-500/20 text-gray-400',
  }[s] ?? 'bg-gray-500/20 text-gray-400');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🚨 Fraud Center</h1>
        <p className="text-gray-500 text-sm mt-1">Monitor and investigate fraud cases</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Total Cases</div>
          <div className="text-xl font-bold text-white">{cases.length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Detected</div>
          <div className="text-xl font-bold text-yellow-400">{cases.filter(c => c.status === 'detected').length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Reviewing</div>
          <div className="text-xl font-bold text-blue-400">{cases.filter(c => c.status === 'reviewing').length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Critical</div>
          <div className="text-xl font-bold text-red-400">{cases.filter(c => c.severity === 'critical').length}</div>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Case</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">User</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Severity</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-sm text-white">#{c.caseNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{c.username}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{c.flagType}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${severityColor(c.severity)}`}>
                    {c.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">{c.status}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setSelectedCase(c)} className="text-xs text-blue-400 hover:text-blue-300">Review</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Case Detail Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Case #{selectedCase.caseNumber}</h2>
                <p className="text-sm text-gray-500">{selectedCase.flagType} · {selectedCase.severity}</p>
              </div>
              <button onClick={() => setSelectedCase(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 mb-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500">User</div>
                <div className="text-sm text-white">{selectedCase.username} ({selectedCase.userId})</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500">Evidence</div>
                <div className="text-sm text-gray-300">Case details available in full investigation</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-yellow-600/20 text-yellow-400 rounded-lg text-xs font-medium hover:bg-yellow-600/30">Mark Review</button>
              <button className="px-3 py-1.5 bg-orange-600/20 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-600/30">Freeze Rewards</button>
              <button className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-600/30">Suspend</button>
              <button className="px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-600/30">Clear Flag</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
