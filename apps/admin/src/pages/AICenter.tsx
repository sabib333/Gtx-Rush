/**
 * GTX Rush — AI Center Admin Page (§48)
 *
 * 🤖 AI CENTER
 * Shows:
 * - Active Models + Versions + Health
 * - Recommendation Metrics (impressions, CTR, completions)
 * - Fraud Flags + False Positive Rate
 * - Experiment Status
 * - Model Health (precision, recall, drift)
 * - AI Review Queue (open cases)
 *
 * Actions:
 * - Register model version
 * - Transition model status (test → shadow → active → retired)
 * - Rollback model
 * - Review cases: confirm / dismiss / escalate / restrict
 *
 * Security (§48, §55):
 * - All data fetched from admin-only API endpoints
 * - Risk scores visible only to authorized operators
 * - Actions are audit logged
 *
 * Contract: AI Intelligence Contract v1.0
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function getAdminToken(): string | null {
  return localStorage.getItem('admin_token');
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  const token = getAdminToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed: ${res.status}`);
  return data;
}

// ============================================================
// Types
// ============================================================

interface ModelVersion {
  modelId: string;
  kind: string;
  version: string;
  trainingDatasetVersion: string;
  deployedAt: string | null;
  status: string;
  featureSetVersion: string;
}

interface ModelHealth {
  modelId: string;
  version: string;
  status: string;
  totalPredictions: number;
  confirmedFraud: number;
  falsePositives: number;
  falsePositiveRate: number;
  precision: number;
  recall: number;
  driftFlagged: boolean;
  lastEvaluatedAt: string | null;
}

interface ReviewCase {
  id: string;
  caseType: string;
  subjectId: string;
  decisionId: string;
  riskScore: number;
  riskLevel: string;
  reasonCodes: string[];
  status: string;
  assignedTo: string | null;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface ReviewQueueStats {
  open: number;
  confirmed: number;
  dismissed: number;
  escalated: number;
  restricted: number;
}

interface AIMetrics {
  activeModels: number;
  shadowModels: number;
  reviewQueue: ReviewQueueStats;
  health: ModelHealth[];
  shadowEvaluations: Array<{ modelId: string; eligibleForPromotion: boolean; totalComparisons: number; falsePositiveRate: number; reasonCode: string }>;
}

// ============================================================
// Helper Components
// ============================================================

function MetricCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
      <div className="text-gray-500 text-xs">{label}</div>
      <div className={`text-xl font-bold mt-1 ${color ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    shadow: 'bg-yellow-500/20 text-yellow-400',
    test: 'bg-blue-500/20 text-blue-400',
    retired: 'bg-gray-500/20 text-gray-400',
    open: 'bg-orange-500/20 text-orange-400',
    confirmed: 'bg-red-500/20 text-red-400',
    dismissed: 'bg-green-500/20 text-green-400',
    escalated: 'bg-purple-500/20 text-purple-400',
    restricted: 'bg-red-700/20 text-red-300',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors[status] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {status.toUpperCase()}
    </span>
  );
}

function RiskLevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: 'bg-gray-500/20 text-gray-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-orange-500/20 text-orange-400',
    critical: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors[level] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {level}
    </span>
  );
}

// ============================================================
// Main Page
// ============================================================

export function AICenter() {
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [reviewCases, setReviewCases] = useState<ReviewCase[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewQueueStats>({ open: 0, confirmed: 0, dismissed: 0, escalated: 0, restricted: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'reviews'>('overview');
  const [selectedCase, setSelectedCase] = useState<ReviewCase | null>(null);
  const [actionNote, setActionNote] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, modelsRes, reviewsRes] = await Promise.all([
        adminRequest<{ success: boolean; data: AIMetrics }>('/api/admin/ai/metrics'),
        adminRequest<{ success: boolean; data: { models: ModelVersion[]; health: ModelHealth[] } }>('/api/admin/ai/models'),
        adminRequest<{ success: boolean; data: { cases: ReviewCase[]; stats: ReviewQueueStats } }>('/api/admin/ai/reviews'),
      ]);

      if (metricsRes.success) setMetrics(metricsRes.data);
      if (modelsRes.success) setModels(modelsRes.data.models);
      if (reviewsRes.success) {
        setReviewCases(reviewsRes.data.cases);
        setReviewStats(reviewsRes.data.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReviewAction = async (caseId: string, action: string) => {
    try {
      await adminRequest(`/api/admin/ai/reviews/${caseId}`, {
        method: 'POST',
        body: JSON.stringify({ action, resolution: actionNote || undefined }),
      });
      setSelectedCase(null);
      setActionNote('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleModelStatusChange = async (modelId: string, version: string, status: string) => {
    try {
      await adminRequest('/api/admin/ai/models/status', {
        method: 'POST',
        body: JSON.stringify({ modelId, version, status }),
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status change failed');
    }
  };

  const handleRollback = async (modelId: string, toVersion: string) => {
    try {
      await adminRequest('/api/admin/ai/models/rollback', {
        method: 'POST',
        body: JSON.stringify({ modelId, toVersion }),
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading AI Center...</div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const m = metrics ?? { activeModels: 0, shadowModels: 0, reviewQueue: reviewStats, health: [], shadowEvaluations: [] };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🤖 AI CENTER</h1>
          <p className="text-gray-500 text-sm mt-1">Model management, review queue, and intelligence metrics</p>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1 w-fit">
        {(['overview', 'models', 'reviews'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab === 'overview' && '📊 Overview'}
            {tab === 'models' && '🧠 Models'}
            {tab === 'reviews' && `🔍 Review Queue${reviewStats.open > 0 ? ` (${reviewStats.open})` : ''}`}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* Overview Tab */}
      {/* ============================================================ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Active Models" value={m.activeModels} color="text-green-400" />
            <MetricCard label="Shadow Models" value={m.shadowModels} color="text-yellow-400" />
            <MetricCard label="Open Review Cases" value={m.reviewQueue.open} color="text-orange-400" />
            <MetricCard label="Drift-Flagged" value={m.health.filter((h) => h.driftFlagged).length} color="text-red-400" />
          </div>

          {/* Model Health Grid */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Model Health</h2>
            {m.health.length === 0 ? (
              <p className="text-gray-600 text-sm">No models registered yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {m.health.map((h) => (
                  <div key={h.modelId} className={`border rounded-lg p-3 ${h.driftFlagged ? 'border-red-500/30 bg-red-500/5' : 'border-gray-800 bg-gray-800/30'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{h.modelId}</span>
                      <StatusBadge status={h.status} />
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>Version: <span className="text-gray-300">{h.version}</span></div>
                      <div>Predictions: <span className="text-gray-300">{h.totalPredictions}</span></div>
                      <div>Precision: <span className="text-gray-300">{(h.precision * 100).toFixed(1)}%</span></div>
                      <div>Recall: <span className="text-gray-300">{(h.recall * 100).toFixed(1)}%</span></div>
                      <div>False Positive Rate: <span className={h.falsePositiveRate > 0.05 ? 'text-red-400' : 'text-gray-300'}>{(h.falsePositiveRate * 100).toFixed(1)}%</span></div>
                    </div>
                    {h.driftFlagged && (
                      <div className="mt-2 text-xs text-red-400 font-medium">⚠ DRIFT DETECTED</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shadow Model Evaluations */}
          {m.shadowEvaluations.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Shadow Mode Evaluations</h2>
              <div className="space-y-2">
                {m.shadowEvaluations.map((se) => (
                  <div key={se.modelId} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                    <div>
                      <span className="text-sm text-white">{se.modelId}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {se.totalComparisons} comparisons · FP rate: {(se.falsePositiveRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${se.eligibleForPromotion ? 'text-green-400' : 'text-yellow-400'}`}>
                        {se.eligibleForPromotion ? '✓ Eligible for promotion' : se.reasonCode}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Queue Summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Review Queue Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">{reviewStats.open}</div>
                <div className="text-xs text-gray-500">Open</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{reviewStats.confirmed}</div>
                <div className="text-xs text-gray-500">Confirmed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{reviewStats.dismissed}</div>
                <div className="text-xs text-gray-500">Dismissed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{reviewStats.escalated}</div>
                <div className="text-xs text-gray-500">Escalated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-300">{reviewStats.restricted}</div>
                <div className="text-xs text-gray-500">Restricted</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Models Tab */}
      {/* ============================================================ */}
      {activeTab === 'models' && (
        <div className="space-y-4">
          {models.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-500">No models registered yet. Register a model via the API to get started.</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Model</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Kind</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Version</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Dataset</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Deployed</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr key={`${model.modelId}:${model.version}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-sm text-white font-medium">{model.modelId}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{model.kind}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{model.version}</td>
                      <td className="px-4 py-3"><StatusBadge status={model.status} /></td>
                      <td className="px-4 py-3 text-sm text-gray-500">{model.trainingDatasetVersion}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {model.deployedAt ? new Date(model.deployedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {model.status === 'test' && (
                            <button
                              onClick={() => handleModelStatusChange(model.modelId, model.version, 'shadow')}
                              className="text-xs px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded hover:bg-yellow-600/30"
                            >
                              → Shadow
                            </button>
                          )}
                          {model.status === 'shadow' && (
                            <button
                              onClick={() => handleModelStatusChange(model.modelId, model.version, 'active')}
                              className="text-xs px-2 py-1 bg-green-600/20 text-green-400 rounded hover:bg-green-600/30"
                            >
                              → Active
                            </button>
                          )}
                          {model.status === 'active' && (
                            <>
                              <button
                                onClick={() => handleModelStatusChange(model.modelId, model.version, 'retired')}
                                className="text-xs px-2 py-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
                              >
                                → Retire
                              </button>
                              <button
                                onClick={() => {
                                  // Find the next version to rollback to (any non-retired version)
                                  const rollbackTarget = models.find(
                                    (m) => m.modelId === model.modelId && m.version !== model.version && m.status !== 'retired',
                                  );
                                  if (rollbackTarget) handleRollback(model.modelId, rollbackTarget.version);
                                }}
                                className="text-xs px-2 py-1 bg-orange-600/20 text-orange-400 rounded hover:bg-orange-600/30"
                              >
                                ↩ Rollback
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Review Queue Tab */}
      {/* ============================================================ */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          {reviewCases.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-500">No open review cases. All clear! ✨</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Case</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Subject</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Risk Score</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Risk Level</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Signals</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase">Created</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewCases.map((c) => (
                    <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-sm text-white font-mono">{c.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{c.caseType}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{c.subjectId}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${
                          c.riskScore >= 85 ? 'text-red-400' :
                          c.riskScore >= 65 ? 'text-orange-400' :
                          c.riskScore >= 40 ? 'text-yellow-400' : 'text-gray-400'
                        }`}>
                          {c.riskScore}
                        </span>
                      </td>
                      <td className="px-4 py-3"><RiskLevelBadge level={c.riskLevel} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.reasonCodes.slice(0, 3).map((code, i) => (
                            <span key={i} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                              {code}
                            </span>
                          ))}
                          {c.reasonCodes.length > 3 && (
                            <span className="text-xs text-gray-600">+{c.reasonCodes.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedCase(c)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Review Case Detail Modal (§29) */}
      {/* ============================================================ */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">AI Review Case</h2>
                <p className="text-sm text-gray-500">
                  {selectedCase.caseType} · {selectedCase.subjectId}
                </p>
              </div>
              <button
                onClick={() => { setSelectedCase(null); setActionNote(''); }}
                className="text-gray-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500">Risk Score</div>
                <div className={`text-lg font-bold ${
                  selectedCase.riskScore >= 85 ? 'text-red-400' :
                  selectedCase.riskScore >= 65 ? 'text-orange-400' :
                  selectedCase.riskScore >= 40 ? 'text-yellow-400' : 'text-gray-300'
                }`}>
                  {selectedCase.riskScore} / 100
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Risk Level</div>
                <RiskLevelBadge level={selectedCase.riskLevel} />
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Reason Codes</div>
                <div className="flex flex-wrap gap-1">
                  {selectedCase.reasonCodes.map((code, i) => (
                    <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                      {code}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500">Decision ID</div>
                <div className="text-sm text-gray-300 font-mono">{selectedCase.decisionId}</div>
              </div>
            </div>

            {/* Resolution note */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">Resolution Note (optional)</label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                rows={2}
                placeholder="Why this action..."
              />
            </div>

            {/* Admin Actions (§29) */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleReviewAction(selectedCase.id, 'confirm')}
                className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-600/30"
              >
                ✓ Confirm Fraud
              </button>
              <button
                onClick={() => handleReviewAction(selectedCase.id, 'dismiss')}
                className="px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-600/30"
              >
                ✗ Dismiss
              </button>
              <button
                onClick={() => handleReviewAction(selectedCase.id, 'escalate')}
                className="px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-600/30"
              >
                ↑ Escalate
              </button>
              <button
                onClick={() => handleReviewAction(selectedCase.id, 'restrict')}
                className="px-3 py-1.5 bg-orange-600/20 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-600/30"
              >
                ⚠ Restrict
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
