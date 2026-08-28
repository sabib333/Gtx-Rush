/**
 * GTX Rush — Admin Audit Log Page
 */

import { useState } from 'react';

interface AuditEntry {
  id: string; action: string; targetType: string; targetId: string | null;
  reason: string | null; ipAddress: string | null; createdAt: string;
}

const MOCK_AUDIT: AuditEntry[] = [
  { id: 'a-001', action: 'ADMIN_LOGIN', targetType: 'admin_user', targetId: 'adm-001', reason: null, ipAddress: '127.0.0.1', createdAt: new Date().toISOString() },
  { id: 'a-002', action: 'FEATURE_FLAG_TOGGLED', targetType: 'feature_flag', targetId: 'ff-001', reason: 'Enabled new home for 25%', ipAddress: '127.0.0.1', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'a-003', action: 'EVENT_UPDATED', targetType: 'event', targetId: 'evt-001', reason: 'Event started', ipAddress: '127.0.0.1', createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'a-004', action: 'GAME_ENABLED', targetType: 'game', targetId: 'game-reaction-rush', reason: 'Game re-enabled after maintenance', ipAddress: '127.0.0.1', createdAt: new Date(Date.now() - 10800000).toISOString() },
];

export function Audit() {
  const [entries] = useState<AuditEntry[]>(MOCK_AUDIT);
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? entries.filter((e) => e.action.includes(filter.toUpperCase()))
    : entries;

  const actionColor = (action: string) => {
    if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'text-blue-400';
    if (action.includes('FEATURE') || action.includes('CONFIG')) return 'text-purple-400';
    if (action.includes('EVENT') || action.includes('GAME')) return 'text-green-400';
    if (action.includes('USER') || action.includes('FRAUD')) return 'text-red-400';
    if (action.includes('MODERATION')) return 'text-orange-400';
    if (action.includes('EMERGENCY') || action.includes('KILL')) return 'text-red-500';
    return 'text-gray-400';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">📋 Audit Log</h1>
        <p className="text-gray-500 text-sm mt-1">Immutable record of all admin actions</p>
      </div>

      {/* Filter */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by action type..."
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
          <span className="text-xs text-gray-500 self-center">{filtered.length} entries</span>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Time</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Action</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Target</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Reason</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">IP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-2 text-xs text-gray-500">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span className={`text-sm font-medium ${actionColor(entry.action)}`}>
                    {entry.action}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-400">
                  {entry.targetType}
                  {entry.targetId && <span className="text-gray-600"> / {entry.targetId}</span>}
                </td>
                <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate">
                  {entry.reason ?? '—'}
                </td>
                <td className="px-4 py-2 text-xs text-gray-600">
                  {entry.ipAddress ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
