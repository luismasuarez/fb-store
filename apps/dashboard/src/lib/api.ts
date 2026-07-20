import type {
  Profile,
  SessionCheckResult,
  Group,
  ScrapeResult,
  JobState,
  LoginSession,
  ScheduleConfig,
  ScrapeLog,
} from './types'

const BASE = import.meta.env.PUBLIC_API_URL ?? ''
const API_KEY = import.meta.env.PUBLIC_API_KEY ?? ''

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...opts,
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
      ...(opts.headers as Record<string, string>),
    },
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
  return body.data ?? body
}

export const api = {
  profiles: {
    list: () => request<{ profiles: Profile[] }>('/profiles').then((d) => d.profiles),
    create: (name: string) => request<{ name: string; path: string }>('/profiles', { method: 'POST', body: JSON.stringify({ name }) }),
    remove: (name: string) => request<void>(`/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    check: (name: string) => request<SessionCheckResult>(`/profiles/${encodeURIComponent(name)}/check`),
  },

  groups: {
    list: () => request<Group[]>('/groups'),
    get: (id: string) => request<Group>(`/groups/${encodeURIComponent(id)}`),
    create: (data: { id: string; name?: string; maxPosts?: number }) =>
      request<Group>('/groups', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; maxPosts?: number; isActive?: boolean }) =>
      request<Group>(`/groups/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/groups/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },

  scrape: {
    run: (data: { url?: string; groupId?: string; maxPosts?: number; profile?: string }) =>
      request<ScrapeResult & { jobId?: string }>('/scrape', {
        method: 'POST',
        body: JSON.stringify({ ...data, wait: true }),
      }),
    job: (id: string) => request<JobState>(`/scrape/${encodeURIComponent(id)}`),
    active: (profile: string) => request<{ active: boolean } & Partial<JobState>>(`/scrape/active/${encodeURIComponent(profile)}`),
  },

  login: {
    start: (profile: string) => request<LoginSession>('/login', { method: 'POST', body: JSON.stringify({ profile }) }),
    status: (profile: string) => request<LoginSession>(`/login/${encodeURIComponent(profile)}/status`),
    complete: (profile: string) => request<LoginSession>(`/login/${encodeURIComponent(profile)}/complete`, { method: 'POST' }),
  },

  logs: {
    list: () => request<ScrapeLog[]>('/scrape-logs'),
  },

  schedule: {
    get: () => request<ScheduleConfig>('/schedule'),
    update: (data: { intervalMinutes?: number; enabled?: boolean }) =>
      request<ScheduleConfig>('/schedule', { method: 'PUT', body: JSON.stringify(data) }),
  },
}

export function extractGroupId(url: string): string | null {
  const m = url.match(/facebook\.com\/groups\/([^/?]+)/)
  return m ? m[1] : null
}
