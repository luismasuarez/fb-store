import type { RawPost } from "../extractor";

export interface SSEClient {
  send(event: string, data: string): void;
  close(): void;
}

export type JobStatus = "pending" | "running" | "completed" | "failed";

export type JobPhase = "queued" | "navigating" | "scrolling" | "extracting" | "downloading" | "saving";

export interface JobState {
  id: string;
  status: JobStatus;
  config: {
    url?: string;
    groupId?: string;
    maxPosts: number;
    profile: string;
  };
  progress: {
    phase: JobPhase;
    current: number;
    total: number;
  };
  result?: {
    posts: RawPost[];
    metrics: {
      postsFound: number;
      postsNew: number;
      durationMs: number;
    };
  };
  failedReason?: string;
  createdAt: Date;
  sseClients: Set<SSEClient>;
}

const jobs = new Map<string, JobState>();

export function createJob(
  id: string,
  config: JobState["config"],
): JobState {
  const job: JobState = {
    id,
    status: "pending",
    config,
    progress: { phase: "queued", current: 0, total: 0 },
    createdAt: new Date(),
    sseClients: new Set(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): JobState | undefined {
  return jobs.get(id);
}

export function updateJob(
  id: string,
  partial: Partial<Pick<JobState, "status" | "progress" | "result" | "failedReason">>,
): JobState | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  Object.assign(job, partial);
  return job;
}

export function deleteJob(id: string): boolean {
  return jobs.delete(id);
}

export function getActiveJobForProfile(profile: string): JobState | undefined {
  for (const job of jobs.values()) {
    if (job.config.profile === profile && (job.status === "pending" || job.status === "running")) {
      return job;
    }
  }
  return undefined;
}

const sseCompletions = new Map<string, () => void>();

export function registerSSE(jobId: string, client: SSEClient): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.sseClients.add(client);
}

export function notifyClients(jobId: string, event: { type: string; data: any }): void {
  const job = jobs.get(jobId);
  if (!job) return;

  const data = JSON.stringify(event.data);
  for (const client of job.sseClients) {
    client.send(event.type, data);
  }

  if ((event.type === "complete" || event.type === "error") && job.sseClients.size > 0) {
    const cb = sseCompletions.get(jobId);
    if (cb) {
      sseCompletions.delete(jobId);
      cb();
    }
  }
}

export function removeSSE(jobId: string, client: SSEClient): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.sseClients.delete(client);
  if (job.sseClients.size === 0) {
    sseCompletions.delete(jobId);
  }
}

export function onJobCompletion(jobId: string, cb: () => void): void {
  sseCompletions.set(jobId, cb);
}

export function removeJobCompletion(jobId: string): void {
  sseCompletions.delete(jobId);
}
