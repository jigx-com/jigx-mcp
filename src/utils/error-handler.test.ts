import assert from 'node:assert'
import { test } from 'node:test'
import { z } from 'zod'
import {
  categorizeError,
  ErrorCategory,
  formatErrorResponse,
  getErrorSuggestion,
  isRetryableError,
  JigxError,
  sanitizeErrorMessage,
  withRetry
} from './error-handler'

test('JigxError - should create error with category', () => {
  const error = new JigxError('Test error', ErrorCategory.API_ERROR, 400, { foo: 'bar' })

  assert.strictEqual(error.message, 'Test error')
  assert.strictEqual(error.category, ErrorCategory.API_ERROR)
  assert.strictEqual(error.statusCode, 400)
  assert.deepStrictEqual(error.details, { foo: 'bar' })
})

test('isRetryableError - should identify retryable errors', () => {
  // Network errors are retryable
  assert.strictEqual(isRetryableError({ code: 'ECONNREFUSED' }), true)
  assert.strictEqual(isRetryableError({ code: 'ETIMEDOUT' }), true)
  assert.strictEqual(isRetryableError({ code: 'ENOTFOUND' }), true)

  // 5xx errors are retryable
  assert.strictEqual(isRetryableError({ statusCode: 500 }), true)
  assert.strictEqual(isRetryableError({ statusCode: 503 }), true)

  // Rate limit is retryable
  assert.strictEqual(isRetryableError({ statusCode: 429 }), true)

  // 4xx errors are not retryable (except 429)
  assert.strictEqual(isRetryableError({ statusCode: 400 }), false)
  assert.strictEqual(isRetryableError({ statusCode: 401 }), false)
  assert.strictEqual(isRetryableError({ statusCode: 404 }), false)
})

test('categorizeError - should categorize errors correctly', () => {
  // Zod errors
  const zodError = new z.ZodError([])
  assert.strictEqual(categorizeError(zodError), ErrorCategory.VALIDATION)

  // HTTP status codes
  assert.strictEqual(categorizeError({ statusCode: 401 }), ErrorCategory.AUTHENTICATION)
  assert.strictEqual(categorizeError({ statusCode: 403 }), ErrorCategory.AUTHORIZATION)
  assert.strictEqual(categorizeError({ statusCode: 404 }), ErrorCategory.NOT_FOUND)
  assert.strictEqual(categorizeError({ statusCode: 429 }), ErrorCategory.RATE_LIMIT)
  assert.strictEqual(categorizeError({ statusCode: 400 }), ErrorCategory.API_ERROR)
  assert.strictEqual(categorizeError({ statusCode: 500 }), ErrorCategory.API_ERROR)

  // Network errors
  assert.strictEqual(categorizeError({ code: 'ECONNREFUSED' }), ErrorCategory.NETWORK)
  assert.strictEqual(categorizeError({ code: 'ETIMEDOUT' }), ErrorCategory.TIMEOUT)

  // Unknown
  assert.strictEqual(categorizeError({}), ErrorCategory.UNKNOWN)
})

test('sanitizeErrorMessage - should remove sensitive data', () => {
  // Remove API keys
  const withApiKey = 'Error: Invalid API key abcdefghijklmnopqrstuvwxyz123456'
  assert.strictEqual(
    sanitizeErrorMessage(withApiKey),
    'Error: Invalid API key ***REDACTED***'
  )

  // Remove sensitive URLs
  const withUrl = 'Failed to connect to https://api.jigx.com/v1/test?apiKey=secret123'
  assert.strictEqual(
    sanitizeErrorMessage(withUrl),
    'Failed to connect to https://api.jigx.com/v1/test'
  )
})

test('getErrorSuggestion - should return helpful suggestions', () => {
  assert.ok(getErrorSuggestion(ErrorCategory.AUTHENTICATION).includes('JIGX_API_KEY'))
  assert.ok(getErrorSuggestion(ErrorCategory.AUTHORIZATION).includes('permissions'))
  assert.ok(getErrorSuggestion(ErrorCategory.NOT_FOUND).includes('resource Id'))
  assert.ok(getErrorSuggestion(ErrorCategory.RATE_LIMIT).includes('rate limited'))
  assert.ok(getErrorSuggestion(ErrorCategory.NETWORK).includes('network'))
  assert.ok(getErrorSuggestion(ErrorCategory.TIMEOUT).includes('timed out'))
  assert.ok(getErrorSuggestion(ErrorCategory.VALIDATION).includes('input parameters'))
})

test('formatErrorResponse - should format errors for MCP', () => {
  const error = new Error('Test error message')
  const response = formatErrorResponse(error)

  assert.strictEqual(response.content[0].type, 'text')
  assert.ok(response.content[0].text.includes('Test error message'))
  assert.ok(response.content[0].text.includes('Suggestion:'))
})

test('formatErrorResponse - should format Zod errors specially', () => {
  const zodError = new z.ZodError([
    {
      code: 'invalid_type',
      expected: 'string',
      received: 'number',
      path: ['field', 'nested'],
      message: 'Expected string, received number'
    }
  ])

  const response = formatErrorResponse(zodError)
  assert.ok(response.content[0].text.includes('Validation Error'))
  assert.ok(response.content[0].text.includes('field.nested: Expected string, received number'))
})

test('withRetry - should retry on retryable errors', async () => {
  let attempts = 0
  const fn = async () => {
    attempts++
    if (attempts < 3) {
      const error: any = new Error('Network error')
      error.code = 'ECONNREFUSED'
      throw error
    }
    return 'success'
  }

  const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 10 })
  assert.strictEqual(result, 'success')
  assert.strictEqual(attempts, 3)
})

test('withRetry - should not retry on non-retryable errors', async () => {
  let attempts = 0
  const fn = async () => {
    attempts++
    const error: any = new Error('Bad request')
    error.statusCode = 400
    throw error
  }

  await assert.rejects(
    withRetry(fn, { maxRetries: 3, initialDelayMs: 10 }),
    /Bad request/
  )
  assert.strictEqual(attempts, 1)
})

test('withRetry - should respect rate limit headers', async () => {
  let attempts = 0
  const startTime = Date.now()

  const fn = async () => {
    attempts++
    if (attempts === 1) {
      const error: any = new Error('Rate limited')
      error.statusCode = 429
      error.headers = { 'retry-after': '1' } // 1 second
      throw error
    }
    return 'success'
  }

  const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 10 })
  const elapsed = Date.now() - startTime

  assert.strictEqual(result, 'success')
  assert.strictEqual(attempts, 2)
  assert.ok(elapsed >= 900, 'Should wait at least 900ms for retry-after header') // Allow some margin
})
