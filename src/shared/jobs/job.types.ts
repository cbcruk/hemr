import type { Id } from '../ids/ids.types.ts'
import type { ProblemDetails } from '../problem/problem.types.ts'

/** Lifecycle state of an asynchronous job. */
export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIALLY_SUCCEEDED' | 'FAILED' | 'CANCELED'

/** Long-running or externally dependent work tracked as a resource. */
export interface Job<TResult = unknown> {
  id: Id<'job'>
  status: JobStatus
  /** Completion ratio from 0 to 1, when the job can estimate it. */
  progress?: number
  result?: TResult
  error?: ProblemDetails
  createdAt: string
  finishedAt?: string
}
