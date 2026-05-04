import { DashboardData, Tech, TechDetail, Upload, UploadPreview, AIAnalysis, Period, ColumnMapping } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data as T;
}

export const api = {
  // Dashboard
  getDashboard: (params: {
    period: Period;
    start?: string;
    end?: string;
    jobsPage?: number;
    filterTech?: string;
    jobSearch?: string;
  }): Promise<DashboardData> => {
    const p = new URLSearchParams({ period: params.period });
    if (params.start) p.set('start', params.start);
    if (params.end) p.set('end', params.end);
    if (params.jobsPage && params.jobsPage > 1) p.set('jobsPage', String(params.jobsPage));
    if (params.filterTech) p.set('filterTech', params.filterTech);
    if (params.jobSearch) p.set('jobSearch', params.jobSearch);
    return request(`/dashboard?${p}`);
  },

  // Techs
  getTechs: (params: {
    period?: Period;
    start?: string;
    end?: string;
    sort?: 'jobs' | 'name';
    order?: 'asc' | 'desc';
    search?: string;
  }): Promise<{ techs: Tech[]; teamAvg: number; dateRange: { start: string; end: string } }> => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
    return request(`/techs?${p}`);
  },

  getTech: (id: string, period: Period, start?: string, end?: string, page = 1): Promise<TechDetail> => {
    const params = new URLSearchParams({ period, page: String(page) });
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    return request(`/techs/${encodeURIComponent(id)}?${params}`);
  },

  // Upload
  previewUpload: (file: File): Promise<UploadPreview> => {
    const form = new FormData();
    form.append('file', file);
    return request('/upload/preview', { method: 'POST', body: form });
  },

  remapUpload: (sessionId: string, mapping: Partial<ColumnMapping>): Promise<UploadPreview> => {
    return request('/upload/remap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, mapping }),
    });
  },

  confirmUpload: (sessionId: string): Promise<{ success: boolean; jobsImported: number; message: string }> => {
    return request('/upload/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  },

  getUploadHistory: (): Promise<Upload[]> => request('/upload/history'),

  deleteUpload: (id: number): Promise<{ success: boolean }> =>
    request(`/upload/${id}`, { method: 'DELETE' }),

  // AI
  analyzeTeam: (period: Period, start?: string, end?: string): Promise<AIAnalysis> => {
    return request('/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period, start, end }),
    });
  },

  // Export
  exportJobsCsv: (start: string, end: string, techId?: string): void => {
    const p = new URLSearchParams({ start, end });
    if (techId) p.set('tech_id', techId);
    window.location.href = `${API_BASE}/export/jobs?${p}`;
  },

  exportTechsCsv: (start: string, end: string): void => {
    window.location.href = `${API_BASE}/export/techs?start=${start}&end=${end}`;
  },

  exportDailySummaryExcel: (date: string): void => {
    window.location.href = `${API_BASE}/export/daily-summary?date=${encodeURIComponent(date)}`;
  },

  queryAI: (question: string, period: Period): Promise<{ answer: string }> => {
    return request('/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, period }),
    });
  },
};
