import type { Id } from '../ids/ids.types.ts'
import type { ProblemDetails } from '../problem/problem.types.ts'

/** 비동기 작업의 진행 상태입니다. */
export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIALLY_SUCCEEDED' | 'FAILED' | 'CANCELED'

/** 오래 걸리거나 외부에 의존하는 작업을 리소스로 추적합니다. */
export interface Job<TResult = unknown> {
  id: Id<'job'>
  status: JobStatus
  /** 0부터 1까지의 진행률입니다. 작업이 추정할 수 있을 때만 있습니다. */
  progress?: number
  result?: TResult
  error?: ProblemDetails
  createdAt: string
  finishedAt?: string
}
