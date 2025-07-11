export interface JigxConfig {
  readonly apiKey: string
  readonly baseUrl?: string
  readonly region?: string
}

export interface ApiResponse<T = any> {
  readonly data?: T
  readonly error?: {
    readonly code: string
    readonly message: string
    readonly details?: any
  }
  readonly status: number
}

export interface PaginatedResponse<T> {
  readonly items: readonly T[]
  readonly continuationToken?: string
  readonly total?: number
}
