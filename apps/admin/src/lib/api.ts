/**
 * GTX Rush — Admin API Client
 *
 * Handles all admin API communication with proper auth headers.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

let adminToken: string | null = localStorage.getItem('admin_token');

export function setAdminToken(token: string | null): void {
  adminToken = token;
  if (token) {
    localStorage.setItem('admin_token', token);
  } else {
    localStorage.removeItem('admin_token');
  }
}

export function getAdminToken(): string | null {
  return adminToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Request failed: ${response.status}`);
  }

  return data;
}

// ============================================================
// Auth
// ============================================================

export async function adminLogin(email: string, password: string) {
  const result = await request<{
    success: boolean;
    data?: { token: string; admin: { id: string; email: string; displayName: string; role: string; permissions: string[] } };
    error?: { message: string };
  }>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (result.success && result.data?.token) {
    setAdminToken(result.data.token);
  }

  return result;
}

export async function adminLogout() {
  await request('/api/admin/auth/logout', { method: 'POST' });
  setAdminToken(null);
}

export async function getAdminMe() {
  return request<{ success: boolean; data: { id: string; email: string; displayName: string; role: string; permissions: string[] } }>(
    '/api/admin/auth/me',
  );
}

// ============================================================
// Dashboard
// ============================================================

export async function getDashboardStats() {
  return request<{ success: boolean; data: Record<string, number> }>('/api/admin/dashboard/stats');
}

export async function getSystemStatus() {
  return request<{ success: boolean; data: Record<string, { name: string; status: string; latencyMs: number }> }>('/api/admin/dashboard/system-status');
}

export async function getDashboardOverview() {
  return request<{ success: boolean; data: {
    stats: Record<string, number>;
    systemStatus: Record<string, { name: string; status: string; latencyMs: number }> | null;
    killSwitches: Record<string, boolean>;
    recentActivity: Array<{ id: string; action: string; targetType: string; timestamp: string }>;
  } }>('/api/admin/dashboard/overview');
}

// ============================================================
// Users
// ============================================================

export async function searchUsers(params: { q?: string; status?: string; limit?: number; offset?: number }) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  return request<{ success: boolean; data: { users: unknown[]; total: number } }>(`/api/admin/users/search?${query}`);
}

export async function getUser(id: string) {
  return request<{ success: boolean; data: unknown }>(`/api/admin/users/${id}`);
}

export async function restrictUser(id: string, reason: string) {
  return request(`/api/admin/users/${id}/restrict`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export async function suspendUser(id: string, reason: string) {
  return request(`/api/admin/users/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export async function restoreUser(id: string, reason: string) {
  return request(`/api/admin/users/${id}/restore`, { method: 'POST', body: JSON.stringify({ reason }) });
}

// ============================================================
// Games
// ============================================================

export async function getGames() {
  return request<{ success: boolean; data: unknown[] }>('/api/admin/games');
}

export async function getGame(id: string) {
  return request<{ success: boolean; data: unknown }>(`/api/admin/games/${id}`);
}

export async function updateGameStatus(id: string, status: string, reason: string) {
  return request(`/api/admin/games/${id}/status`, { method: 'POST', body: JSON.stringify({ status, reason }) });
}

export async function updateGameConfig(id: string, config: Record<string, unknown>, reason: string) {
  return request(`/api/admin/games/${id}/config`, { method: 'POST', body: JSON.stringify({ config, reason }) });
}

// ============================================================
// Events
// ============================================================

export async function getEvents(status?: string) {
  const query = status ? `?status=${status}` : '';
  return request<{ success: boolean; data: unknown[] }>(`/api/admin/events${query}`);
}

export async function createEvent(data: Record<string, unknown>) {
  return request('/api/admin/events', { method: 'POST', body: JSON.stringify(data) });
}

export async function publishEvent(id: string) {
  return request(`/api/admin/events/${id}/publish`, { method: 'POST' });
}

export async function startEvent(id: string) {
  return request(`/api/admin/events/${id}/start`, { method: 'POST' });
}

export async function pauseEvent(id: string, reason: string) {
  return request(`/api/admin/events/${id}/pause`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export async function endEvent(id: string) {
  return request(`/api/admin/events/${id}/end`, { method: 'POST' });
}

// ============================================================
// Fraud
// ============================================================

export async function getFraudCases(params?: { status?: string; severity?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.severity) query.set('severity', params.severity);
  return request<{ success: boolean; data: { cases: unknown[]; summary: Record<string, number> } }>(`/api/admin/fraud?${query}`);
}

export async function takeFraudAction(id: string, action: string, reason: string) {
  return request(`/api/admin/fraud/${id}/action`, { method: 'POST', body: JSON.stringify({ action, reason }) });
}

// ============================================================
// Moderation
// ============================================================

export async function getModerationCases(params?: { status?: string; type?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.type) query.set('type', params.type);
  return request<{ success: boolean; data: { cases: unknown[]; queues: Record<string, number> } }>(`/api/admin/moderation?${query}`);
}

export async function takeModerationAction(id: string, action: string, reason: string) {
  return request(`/api/admin/moderation/${id}/action`, { method: 'POST', body: JSON.stringify({ action, reason }) });
}

// ============================================================
// Economy
// ============================================================

export async function getEconomyOverview() {
  return request<{ success: boolean; data: unknown }>('/api/admin/economy/overview');
}

export async function getEconomyTransactions(params?: { userId?: string; source?: string }) {
  const query = new URLSearchParams();
  if (params?.userId) query.set('userId', params.userId);
  if (params?.source) query.set('source', params.source);
  return request<{ success: boolean; data: unknown }>(`/api/admin/economy/transactions?${query}`);
}

// ============================================================
// Payments
// ============================================================

export async function getPaymentsRevenue() {
  return request<{ success: boolean; data: unknown }>('/api/admin/payments/revenue');
}

// ============================================================
// Analytics
// ============================================================

export async function getAnalyticsOverview() {
  return request<{ success: boolean; data: unknown }>('/api/admin/analytics/overview');
}

export async function getAnalyticsFunnel() {
  return request<{ success: boolean; data: unknown }>('/api/admin/analytics/funnel');
}

export async function getAnalyticsCohorts() {
  return request<{ success: boolean; data: unknown }>('/api/admin/analytics/cohorts');
}

// ============================================================
// Experiments
// ============================================================

export async function getExperiments(status?: string) {
  const query = status ? `?status=${status}` : '';
  return request<{ success: boolean; data: unknown[] }>(`/api/admin/experiments${query}`);
}

// ============================================================
// Feature Flags
// ============================================================

export async function getFeatureFlags() {
  return request<{ success: boolean; data: { flags: unknown[]; rolloutPercentages: number[] } }>('/api/admin/features');
}

export async function toggleFeatureFlag(id: string, data: { status?: string; rolloutPercentage?: number; reason: string }) {
  return request(`/api/admin/features/${id}/toggle`, { method: 'POST', body: JSON.stringify(data) });
}

// ============================================================
// Emergency
// ============================================================

export async function getKillSwitches() {
  return request<{ success: boolean; data: unknown[] }>('/api/admin/emergency/kill-switches');
}

export async function toggleKillSwitch(id: string, data: { enabled: boolean; reason: string; confirmation: string }) {
  return request(`/api/admin/emergency/kill-switches/${id}`, { method: 'POST', body: JSON.stringify(data) });
}

// ============================================================
// Alerts
// ============================================================

export async function getAlerts(params?: { status?: string; severity?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.severity) query.set('severity', params.severity);
  return request<{ success: boolean; data: { alerts: unknown[]; summary: Record<string, number> } }>(`/api/admin/alerts?${query}`);
}

export async function acknowledgeAlert(id: string) {
  return request(`/api/admin/alerts/${id}/acknowledge`, { method: 'POST' });
}

// ============================================================
// Audit Log
// ============================================================

export async function getAuditLog(params?: { action?: string; limit?: number; offset?: number }) {
  const query = new URLSearchParams();
  if (params?.action) query.set('action', params.action);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  return request<{ success: boolean; data: { entries: unknown[]; total: number } }>(`/api/admin/audit?${query}`);
}

// ============================================================
// Leaderboards
// ============================================================

export async function getLeaderboards() {
  return request<{ success: boolean; data: unknown[] }>('/api/admin/leaderboards');
}
