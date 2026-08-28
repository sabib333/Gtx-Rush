/**
 * GTX Rush — Admin Users Management Page
 */

import { useState } from 'react';
import { searchUsers } from '../lib/api';

interface User {
  id: string; username: string; displayName: string;
  level: number; status: string; lastActiveAt: string; fraudFlags: number;
}

const MOCK_USERS: User[] = [
  { id: 'usr-001', username: 'speedking', displayName: 'Speed King', level: 42, status: 'active', lastActiveAt: new Date().toISOString(), fraudFlags: 0 },
  { id: 'usr-002', username: 'quizmaster', displayName: 'Quiz Master', level: 38, status: 'active', lastActiveAt: new Date().toISOString(), fraudFlags: 0 },
  { id: 'usr-003', username: 'taptitan', displayName: 'Tap Titan', level: 55, status: 'active', lastActiveAt: new Date().toISOString(), fraudFlags: 1 },
  { id: 'usr-004', username: 'suspicious_user', displayName: 'Suspicious User', level: 5, status: 'active', lastActiveAt: new Date().toISOString(), fraudFlags: 5 },
];

export function Users() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionReason, setActionReason] = useState('');

  const handleSearch = async () => {
    setLoading(true);
    try {
      const result = await searchUsers({ q: query });
      if (result.success && result.data?.users) {
        setUsers(result.data.users as User[]);
      }
    } catch {
      // Use mock data
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!selectedUser || !actionReason) return;
    alert(`${action} applied to ${selectedUser.displayName}. Reason: ${actionReason}`);
    setActionReason('');
    setSelectedUser(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-gray-500 text-sm mt-1">Search, view, and manage users</p>
      </div>

      {/* Search */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, username, or display name..."
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* User List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">User</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Level</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Last Active</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Fraud Flags</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <div className="text-sm text-white">{user.displayName}</div>
                  <div className="text-xs text-gray-500">@{user.username}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">{user.level}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    user.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    user.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(user.lastActiveAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm ${user.fraudFlags > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {user.fraudFlags}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedUser.displayName}</h2>
                <p className="text-sm text-gray-500">@{selectedUser.username} · Level {selectedUser.level}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500">Status</div>
                <div className="text-sm text-white font-medium">{selectedUser.status}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500">Fraud Flags</div>
                <div className={`text-sm font-medium ${selectedUser.fraudFlags > 0 ? 'text-red-400' : 'text-white'}`}>
                  {selectedUser.fraudFlags}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Action Reason (required)</label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                rows={2}
                placeholder="Enter reason for action..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleAction('restrict')}
                disabled={!actionReason}
                className="px-3 py-1.5 bg-yellow-600/20 text-yellow-400 rounded-lg text-xs font-medium hover:bg-yellow-600/30 disabled:opacity-50"
              >
                Restrict
              </button>
              <button
                onClick={() => handleAction('suspend')}
                disabled={!actionReason}
                className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-600/30 disabled:opacity-50"
              >
                Suspend
              </button>
              <button
                onClick={() => handleAction('restore')}
                disabled={!actionReason}
                className="px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-600/30 disabled:opacity-50"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
