export interface Profile {
  name: string
  createdAt: string
  lastUsedAt?: string
  loginStatus: 'unknown' | 'alive' | 'dead' | 'locked'
}

export interface SessionCheckResult {
  alive: boolean
  reason: 'feed-visible' | 'redirected-to-login' | 'network-error' | 'chrome-error'
  checkedAt: string
}

export interface Group {
  id: string
  name: string
  url?: string
  maxPosts: number
  lastScraped?: string
  lastError?: string
  isActive: boolean
  createdAt: string
}

export interface RawPost {
  fbPostId: string
  text: string
  images: string[]
  author: string
  authorUrl: string
  timestamp: string
  postUrl: string
}

export interface ScrapeMetrics {
  groupId: string
  postsFound: number
  postsNew: number
  durationMs: number
}

export interface ScrapeResult {
  posts: RawPost[]
  metrics: ScrapeMetrics
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'
export type JobPhase = 'queued' | 'navigating' | 'scrolling' | 'extracting' | 'downloading' | 'saving'

export interface JobProgress {
  phase: JobPhase
  current: number
  total: number
}

export interface JobState {
  id: string
  status: JobStatus
  config: { url?: string; groupId?: string; maxPosts: number; profile: string }
  progress: JobProgress
  result?: ScrapeResult
  failedReason?: string
  createdAt: string
}

export interface LoginSession {
  profile: string
  state: 'idle' | 'login-in-progress' | 'logged-in'
  vncUrl?: string
  startedAt?: string
}

export interface ScheduleConfig {
  intervalMinutes: number
  enabled: boolean
}

export interface ScrapeLog {
  id: string
  groupId: string
  accountIndex: number
  postsFound: number
  postsNew: number
  postsErrors: number
  startedAt: string
  finishedAt?: string
  durationMs?: number
  error?: string
}
