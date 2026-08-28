/**
 * GTX Rush — Admin Events Management Page
 */

import { useState } from 'react';

interface Event {
  id: string; name: string; game: string; status: string;
  startsAt: string; endsAt: string;
}

const MOCK_EVENTS: Event[] = [
  { id: 'evt-001', name: 'Summer Speed Challenge', game: 'reaction-rush', status: 'active', startsAt: '2024-08-01', endsAt: '2024-08-31' },
  { id: 'evt-002', name: 'Weekend Tap Battle', game: 'tap-rush', status: 'scheduled', startsAt: '2024-08-24', endsAt: '2024-08-25' },
  { id: 'evt-003', name: 'Quiz Championship', game: 'quiz-rush', status: 'draft', startsAt: '2024-09-01', endsAt: '2024-09-07' },
];

export function Events() {
  const [events] = useState<Event[]>(MOCK_EVENTS);
  const [showCreate, setShowCreate] = useState(false);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400',
      scheduled: 'bg-blue-500/20 text-blue-400',
      draft: 'bg-gray-500/20 text-gray-400',
      paused: 'bg-yellow-500/20 text-yellow-400',
      completed: 'bg-purple-500/20 text-purple-400',
    };
    return colors[status] ?? 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Event Management</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage live events</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
        >
          + Create Event
        </button>
      </div>

      {/* Event List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Event</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Game</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Dates</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-sm text-white font-medium">{event.name}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{event.game}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(event.status)}`}>
                    {event.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {event.startsAt} → {event.endsAt}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {event.status === 'draft' && (
                    <button className="text-xs text-green-400 hover:text-green-300">Publish</button>
                  )}
                  {event.status === 'active' && (
                    <button className="text-xs text-yellow-400 hover:text-yellow-300">Pause</button>
                  )}
                  {event.status === 'scheduled' && (
                    <button className="text-xs text-blue-400 hover:text-blue-300">Start</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Event Form */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold text-white">Create Event</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <input placeholder="Event Name" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
              <select className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                <option value="reaction-rush">Reaction Rush</option>
                <option value="tap-rush">Tap Rush</option>
                <option value="quiz-rush">Quiz Rush</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="datetime-local" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
                <input type="datetime-local" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
              </div>
              <textarea placeholder="Description" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" rows={2} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">Save Draft</button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
