/**
 * GTX Rush — Admin Emergency Controls Page
 */

import { useState } from 'react';

interface KillSwitch {
  id: string; label: string; description: string; enabled: boolean;
}

const INITIAL_SWITCHES: KillSwitch[] = [
  { id: 'disable_payments', label: 'Disable Payments', description: 'Prevents all Telegram Stars purchases and payment processing', enabled: false },
  { id: 'disable_creator_publishing', label: 'Disable Creator Publishing', description: 'Prevents creators from publishing new challenges', enabled: false },
  { id: 'disable_rewards', label: 'Disable Rewards', description: 'Prevents XP and reward distribution (gameplay still works)', enabled: false },
  { id: 'disable_event_participation', label: 'Disable Event Participation', description: 'Prevents users from joining or participating in events', enabled: false },
];

export function Emergency() {
  const [switches, setSwitches] = useState<KillSwitch[]>(INITIAL_SWITCHES);
  const [confirmModal, setConfirmModal] = useState<KillSwitch | null>(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const handleToggle = (sw: KillSwitch) => {
    setConfirmModal(sw);
    setReason('');
    setConfirmation('');
  };

  const confirmAction = () => {
    if (!confirmModal || !reason || !confirmation) return;
    if (confirmation !== `CONFIRM_${confirmModal.id.toUpperCase()}`) {
      alert('Invalid confirmation. Please type exactly as shown.');
      return;
    }
    setSwitches((prev) =>
      prev.map((s) => s.id === confirmModal.id ? { ...s, enabled: !s.enabled } : s),
    );
    setConfirmModal(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">⚡ Emergency Controls</h1>
        <p className="text-gray-500 text-sm mt-1">Critical system kill switches — use only for emergencies</p>
      </div>

      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
        <p className="text-red-400 text-sm font-medium">⚠ These controls affect production systems. Every action is logged and requires explicit confirmation.</p>
      </div>

      <div className="space-y-4">
        {switches.map((sw) => (
          <div key={sw.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white">{sw.label}</h3>
              <p className="text-xs text-gray-500 mt-1">{sw.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                sw.enabled ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
              }`}>
                {sw.enabled ? 'ACTIVE' : 'OFF'}
              </span>
              <button
                onClick={() => handleToggle(sw)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  sw.enabled
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {sw.enabled ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-red-500/30 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-red-400 mb-2">⚠ Confirm Emergency Action</h2>
            <p className="text-sm text-gray-300 mb-4">
              You are about to {confirmModal.enabled ? 'deactivate' : 'ACTIVATE'} <strong>{confirmModal.label}</strong>.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reason (required)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                  rows={2}
                  placeholder="Why is this emergency action needed?"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Type <code className="text-red-400">CONFIRM_{confirmModal.id.toUpperCase()}</code> to proceed
                </label>
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                  placeholder={`CONFIRM_${confirmModal.id.toUpperCase()}`}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={confirmAction}
                disabled={!reason || !confirmation}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium"
              >
                Confirm Action
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
