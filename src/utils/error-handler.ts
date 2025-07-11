import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// Error categories
export enum ErrorCategory {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  API_ERROR = 'API_ERROR',
  NETWORK = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

// Custom error class with category
export class JigxError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly statusCode?: number,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'JigxError'
  }
}

// Error response interface
export interface ErrorResponse {
  error: {
    category: ErrorCategory
    message: string
    statusCode?: number
    retryable: boolean
    suggestion?: string
  }
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffFactor: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true
  }

  // 5xx errors are retryable
  if (error.statusCode && error.statusCode >= 500 && error.statusCode < 600) {
    return true
  }

  // Rate limit errors might be retryable after delay
  if (error.statusCode === 429) {
    return true
  }

  return false
}

/**
 * Categorize error based on status code or error type
 */
export function categorizeError(error: any): ErrorCategory {
  // Zod validation errors
  if (error instanceof z.ZodError) {
    return ErrorCategory.VALIDATION
  }

  // HTTP status codes
  if (error.statusCode) {
    switch (error.statusCode) {
      case 401:
        return ErrorCategory.AUTHENTICATION
      case 403:
        return ErrorCategory.AUTHORIZATION
      case 404:
        return ErrorCategory.NOT_FOUND
      case 429:
        return ErrorCategory.RATE_LIMIT
      default:
        if (error.statusCode >= 400 && error.statusCode < 500) {
          return ErrorCategory.API_ERROR
        }
        if (error.statusCode >= 500) {
          return ErrorCategory.API_ERROR
        }
    }
  }

  // Network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return ErrorCategory.NETWORK
  }
  if (error.code === 'ETIMEDOUT') {
    return ErrorCategory.TIMEOUT
  }

  return ErrorCategory.UNKNOWN
}

/**
 * Sanitize error message to remove sensitive data
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove potential API keys (assuming they're 20+ chars of alphanumeric)
  const sanitized = message.replace(/[A-Za-z0-9]{20,}/g, '***REDACTED***')

  // Remove URLs with potential sensitive query params
  return sanitized.replace(/https?:\/\/[^\s]+/g, url => {
    try {
      const parsed = new URL(url)
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
    } catch {
      return '***URL***'
    }
  })
}

/**
 * Get user-friendly error message with suggestions
 */
export function getErrorSuggestion(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.AUTHENTICATION:
      return 'Check that your JIGX_API_KEY is valid and not expired'
    case ErrorCategory.AUTHORIZATION:
      return 'Ensure you have the necessary permissions for this operation'
    case ErrorCategory.NOT_FOUND:
      return 'Verify the resource Id and that it exists in your organization'
    case ErrorCategory.RATE_LIMIT:
      return 'You are being rate limited. Please wait before retrying'
    case ErrorCategory.NETWORK:
      return 'Check your network connection and try again'
    case ErrorCategory.TIMEOUT:
      return 'The request timed out. Try again or check if the service is available'
    case ErrorCategory.VALIDATION:
      return 'Check the input parameters and ensure they meet the requirements'
    default:
      return 'An unexpected error occurred. Please try again'
  }
}

/**
 * Format error for MCP response
 */
export function formatErrorResponse(error: any): CallToolResult {
  const category = categorizeError(error)
  const sanitizedMessage = sanitizeErrorMessage(error.message || String(error))
  const suggestion = getErrorSuggestion(category)

  let errorText = `Error: ${sanitizedMessage}`

  if (error instanceof z.ZodError) {
    errorText = `Validation Error:\n${error.issues.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n')}`
  }

  if (suggestion) {
    errorText += `\n\nSuggestion: ${suggestion}`
  }

  if (isRetryableError(error)) {
    errorText += '\n\nThis error may be temporary. Please try again.'
  }

  return {
    content: [
      {
        type: 'text',
        text: errorText
      }
    ]
  }
}

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: any
  let delay = retryConfig.initialDelayMs

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry if not retryable
      if (!isRetryableError(error)) {
        throw error
      }

      // Don't retry if this was the last attempt
      if (attempt === retryConfig.maxRetries) {
        throw error
      }

      // Check for rate limit headers
      if (lastError && typeof lastError === 'object' && 'statusCode' in lastError && 'headers' in lastError) {
        const err = lastError as any
        if (err.statusCode === 429 && err.headers?.['retry-after']) {
          const retryAfter = parseInt(err.headers['retry-after'])
          if (!isNaN(retryAfter)) {
            delay = retryAfter * 1000
          }
        }
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))

      // Exponential backoff
      delay = Math.min(delay * retryConfig.backoffFactor, retryConfig.maxDelayMs)
    }
  }

  throw lastError
}
