const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('scrb_token');
}

export function getUser(): any {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('scrb_user');
  return u ? JSON.parse(u) : null;
}

export function clearAuth() {
  localStorage.removeItem('scrb_token');
  localStorage.removeItem('scrb_user');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: any = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) { clearAuth(); window.location.href = '/login'; return; }
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'API Error'); }
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) => {
    const form = new URLSearchParams();
    form.append('username', username); form.append('password', password);
    return fetch(`${API_BASE}/auth/login`, { method: 'POST', body: form })
      .then(r => { if (!r.ok) throw new Error('Invalid credentials'); return r.json(); });
  },
  getMe: () => request('/auth/me'),

  // Analytics
  getOverview: () => request('/analytics/overview'),
  getYearlyTrends: () => request('/analytics/trends/yearly'),
  getMonthlyTrends: (year?: number) => request(`/analytics/trends/monthly${year ? `?year=${year}` : ''}`),
  getByDistrict: (year?: number, crimeType?: string) => {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (crimeType) params.set('crime_type', crimeType);
    return request(`/analytics/by-district?${params}`);
  },
  getByCrimeType: (year?: number, district?: string) => {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (district) params.set('district', district);
    return request(`/analytics/by-crime-type?${params}`);
  },
  getSeverityDist: () => request('/analytics/severity-distribution'),
  getHeatmapData: (year?: number, crimeType?: string) => {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (crimeType) params.set('crime_type', crimeType);
    return request(`/analytics/heatmap-data?${params}`);
  },
  getStations: (district?: string) => request(`/analytics/police-stations${district ? `?district=${district}` : ''}`),
  getTimeOfDay: () => request('/analytics/time-of-day'),

  // Chat
  sendMessage: (message: string, sessionId?: number, language?: string) =>
    request('/chat/message', { method: 'POST', body: JSON.stringify({ message, session_id: sessionId, language }) }),
  getSessions: () => request('/chat/sessions'),
  getMessages: (sessionId: number) => request(`/chat/sessions/${sessionId}/messages`),
  deleteSession: (sessionId: number) => request(`/chat/sessions/${sessionId}`, { method: 'DELETE' }),
  getSuggestedQueries: () => request('/chat/suggested-queries'),

  // Network
  getNetworkGraph: (district?: string, riskLevel?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    if (riskLevel) params.set('risk_level', riskLevel);
    if (limit) params.set('limit', String(limit));
    return request(`/network/graph?${params}`);
  },
  getSuspect: (id: number) => request(`/network/suspect/${id}`),

  // Predictions
  getAlerts: (severity?: string, district?: string) => {
    const params = new URLSearchParams();
    if (severity) params.set('severity', severity);
    if (district) params.set('district', district);
    return request(`/predictions/alerts?${params}`);
  },
  getHotspots: () => request('/predictions/hotspots'),
  getDistrictForecast: (district: string) => request(`/predictions/forecast/${encodeURIComponent(district)}`),
  getPredictionSummary: () => request('/predictions/summary'),

  // Audit
  getAuditLogs: (limit?: number, offset?: number) => request(`/audit/logs?limit=${limit || 100}&offset=${offset || 0}`),
  getAuditStats: () => request('/audit/stats'),
};
