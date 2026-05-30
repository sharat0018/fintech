/**
 * FinSight AI — REST API Client
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Seed demo data
  seedDemo: () => request<any>('/api/v1/demo/seed', { method: 'POST' }),

  // Get companies
  getCompanies: () => request<any>('/api/v1/companies'),

  // Get metrics
  getMetrics: (companyId: string) => request<any>(`/api/v1/financials/${companyId}/metrics`),

  // Get transactions
  getTransactions: (companyId: string, limit = 100) =>
    request<any>(`/api/v1/financials/${companyId}/transactions?limit=${limit}`),

  // Get anomalies
  getAnomalies: (companyId: string) => request<any>(`/api/v1/financials/${companyId}/anomalies`),

  // Get forecasts
  getForecasts: (companyId: string) => request<any>(`/api/v1/forecast/${companyId}`),

  // Run simulation
  simulate: (params: any) =>
    request<any>('/api/v1/simulator/simulate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Create single transaction in real-time
  createTransaction: (companyId: string, txn: { date: string; description: string; category: string; amount: number; account_type?: string }) =>
    request<any>('/api/v1/financials/transactions/create', {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId, ...txn }),
    }),

  // Chat with CFO
  chatWithCFO: (companyId: string, prompt: string) =>
    request<any>('/api/v1/chat/ask', {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId, prompt }),
    }),

  // Board report
  getBoardReport: (companyId: string) => request<any>(`/api/v1/reports/${companyId}/board`),

  // Investor report
  getInvestorReport: (companyId: string) => request<any>(`/api/v1/reports/${companyId}/investor`),

  // Upload file
  uploadFile: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/api/v1/financials/upload`, {
      method: 'POST',
      body: form,
    });
    return res.json();
  },
};
