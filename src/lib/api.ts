/**
 * Centralized API client for ClimateShield MSME
 * - Uses VITE_API_BASE_URL when configured
 * - Falls back to mock data when backend unavailable
 * - All services go through this client to keep endpoint wiring in one place
 */

// Vite exposes env via import.meta.env
const RAW_BASE = (import.meta as unknown as { env: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ?? "";
// Allow empty => mock mode. Normalize trailing slash.
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, "");
export const IS_MOCK_MODE = !API_BASE_URL;
export const API_TIMEOUT_MS = 8000;

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (IS_MOCK_MODE) {
    throw new Error("API mock mode — no base URL configured");
  }

  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const session = localStorage.getItem("aegis-session");
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(session ? { "X-AEGIS-Session": session } : {}),
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      // Correctly parse FastAPI validation errors which use `detail` (string or array) not just `message`
      const rawDetail: any = (body as any)?.detail;
      const detailMessage = Array.isArray(rawDetail)
        ? rawDetail.map((d: any) => d?.msg || d?.message || (typeof d === "string" ? d : JSON.stringify(d))).join("; ")
        : (typeof rawDetail === "string" ? rawDetail : null);
      const message =
        detailMessage ??
        (body as { message?: string })?.message ??
        (body as { detail?: string })?.detail ??
        (typeof body === "string" && body.trim() !== "" ? body : null) ??
        `Request failed: ${res.status}`;
      // Never render undefined/null/"" — ensure non-empty
      const safeMessage = message && String(message).trim() !== "" ? String(message) : `Request failed: ${res.status}`;
      const err: ApiError = { status: res.status, message: safeMessage, details: body };
      throw err;
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw { status: 408, message: "Request timed out" } as ApiError;
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

/** Helper: try real API, fall back to mockFn if in mock mode or request fails */
export async function withFallback<T>(path: string, init: RequestInit | undefined, mockFn: () => Promise<T> | T): Promise<T> {
  if (IS_MOCK_MODE) return await mockFn();
  try {
    return await apiFetch<T>(path, init);
  } catch (err) {
    // In production, you may want to surface the error instead of silently falling back.
    // For hackathon demo resilience we fall back to deterministic mock data.
    console.warn(`[api] ${path} failed, falling back to mock:`, err);
    return await mockFn();
  }
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

// --- Standardized AEGIS API client methods (task 7) — extend rather than duplicate ---
// All interactive dashboard actions should use these instead of scattered fetch calls.
export async function getWeather() {
  return apiFetch<any>('/api/weather', { method: 'GET' });
}
export async function getHistorical(days: number = 90) {
  return apiFetch<any>(`/api/historical?days=${days}`, { method: 'GET' });
}
export async function runScenario(hazard: string, params: Record<string, number>, live?: { temperature?: number; humidity?: number }) {
  const body: any = { hazard, ...params };
  if (live?.temperature !== undefined) body.live_temperature = live.temperature;
  if (live?.humidity !== undefined) body.live_humidity = live.humidity;
  return apiFetch<any>('/api/scenario', { method: 'POST', body: JSON.stringify(body) });
}
export async function getRisk(hazard: string, params: Record<string, number>, confidence: number = 0.78) {
  const qs = buildQuery({ hazard, confidence, ...params } as any);
  return apiFetch<any>(`/api/risk${qs}`, { method: 'GET' });
}
export async function getFinancialImpact(hazard: string, params: Record<string, number>, risk: number, confidence: number = 0.78) {
  const qs = buildQuery({ hazard, risk, confidence, ...params } as any);
  return apiFetch<any>(`/api/financial-impact${qs}`, { method: 'GET' });
}
export async function getAlerts() {
  return apiFetch<any>('/api/alerts', { method: 'GET' });
}
export async function getFinancingAssessment(principal: number, rate: number, tenure: number, confidence: number = 0.78) {
  return apiFetch<any>(`/api/financing/calculate?principal=${principal}&rate=${rate}&tenure=${tenure}&confidence=${confidence}`, { method: 'GET' });
}
export async function getFinancingRecommendation(principal: number, rate: number, confidence: number = 0.78) {
  return apiFetch<any>(`/api/financing/recommend?principal=${principal}&rate=${rate}&confidence=${confidence}`, { method: 'GET' });
}
