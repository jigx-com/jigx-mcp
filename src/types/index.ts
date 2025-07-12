export interface JigxConfig {
  readonly apiKey: string
  readonly baseUrl?: string
  readonly region?: string
}

export interface ApiResponse<T = unknown> {
  readonly data?: T
  readonly error?: {
    readonly code: string
    readonly message: string
    readonly details?: unknown
  }
  readonly status: number
}

export interface PaginatedResponse<T> {
  readonly items: readonly T[]
  readonly continuationToken?: string
  readonly total?: number
}
