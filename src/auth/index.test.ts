import assert from 'node:assert'
import { test } from 'node:test'
import { AuthManager, getAuth, initializeAuth, isAuthInitialized } from './index.js'

test('AuthManager - should initialize with environment variable', () => {
  process.env.JIGX_API_KEY = 'test-api-key-12345'

  const auth = new AuthManager()
  const headers = auth.getHeaders()

  assert.strictEqual(headers.Authorization, 'Bearer test-api-key-12345')
  assert.strictEqual(headers['Content-Type'], 'application/json')
  assert.strictEqual(headers['X-Region'], 'us-east-1')

  delete process.env.JIGX_API_KEY
})

test('AuthManager - should initialize with config', () => {
  const auth = new AuthManager({
    apiKey: 'config-api-key',
    region: 'eu-central-1'
  })

  const headers = auth.getHeaders()
  assert.strictEqual(headers.Authorization, 'Bearer config-api-key')
  assert.strictEqual(headers['X-Region'], 'eu-central-1')
})

test('AuthManager - should throw error when no API key provided', () => {
  assert.throws(
    () => new AuthManager(),
    /JIGX_API_KEY not found/
  )
})

test('AuthManager - should sanitize API key for logging', () => {
  const auth = new AuthManager({ apiKey: 'abcd1234567890efgh' })
  const sanitized = auth.getSanitizedConfig()

  assert.strictEqual(sanitized.apiKey, 'abcd...efgh')
})

test('AuthManager - should sanitize short API keys', () => {
  const auth = new AuthManager({ apiKey: 'short' })
  const sanitized = auth.getSanitizedConfig()

  assert.strictEqual(sanitized.apiKey, '***')
})

test('AuthManager - should get correct base URLs', () => {
  const auth = new AuthManager({ apiKey: 'test' })

  assert.strictEqual(auth.getBaseUrl('v1'), 'https://api.jigx.com/v1')
  assert.strictEqual(auth.getBaseUrl('data/v20'), 'https://api.jigx.com/data/v20')
  assert.strictEqual(auth.getBaseUrl('tool/v20'), 'https://api.jigx.com/tool/v20')
})

test('AuthManager - singleton pattern', () => {
  const auth1 = initializeAuth({ apiKey: 'test-key' })
  const auth2 = getAuth()

  assert.strictEqual(isAuthInitialized(), true)
  assert.strictEqual(auth1, auth2)
})

test('AuthManager - validate method', () => {
  const auth = new AuthManager({ apiKey: 'test-key' })
  assert.strictEqual(auth.validate(), true)
})
