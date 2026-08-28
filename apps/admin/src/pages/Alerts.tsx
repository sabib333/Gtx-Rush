/**
 * GTX Rush — Admin Alerts Page
 */

import { useState } from 'react';

interface Alert {
  id: string; title: string; message: string; severity: string;
  category: string; status: string; createdAt: string;
}

const MOCK_ALERTS: Alert[] = [
  { id: 'alert-001', title: 'Fraud Spike Detected', message: '15 fraud flags in last hour', severity: 'critical', category: 'fraud', status: 'active', createdAt: '2024-08-20T14:30:00' },
  { id: 'alert-002', title: 'Payment Processing Slow', message: 'Latency increased to 2.5s', severity: 'warning', category: 'payments', status: 'acknowledged', createdAt: '2024-08-20T14:45:00' },
  { id: 'alert-003', title: 'DAU Milestone', message: 'DAU reached 12,500', severity: 'info', category: 'analytics', status: 'active', createdAt: '2024-08-20T12:00:00' },
];

export function Alerts() {
  const [alerts] = useState<Alert[]>(MOCK_ALERTS);

  const severityColor = (s: string) => ({
    emergency: 'bg-red-500/30 text-red-300',
    critical: 'bg-red-500/20 text-red-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    info: 'bg-blue-500/20 text-blue-400',
  }[s] ?? 'bg-gray-500/20 text-gray-400');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🔔 Alerts</h1>
        <p className="text-gray-500 text-sm mt-1">Monitor system alerts and notifications</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Active</div>
          <div className="text-xl font-bold text-red-400">{alerts.filter(a => a.status === 'active').length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Acknowledged</div>
          <div className="text-xl font-bold text-yellow-400">{alerts.filter(a => a.status === 'acknowledged').length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Resolved</div>
          <div className="text-xl font-bold text-green-400">{alerts.filter(a => a.status === 'resolved').length}</div>
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded ${severityColor(alert.severity)}`}>
                  {alert.severity}
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">{alert.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{alert.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600">{alert.category}</span>
                <span className="text-xs text-gray-600">{new Date(alert.createdAt).toLocaleString()}</span>
                {alert.status === 'active' && (
                  <button className="px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded text-xs">Acknowledge</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
