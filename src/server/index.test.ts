import * as assert from 'node:assert'
import { test } from 'node:test'
import { createJigxMcpServer } from './index.js'

test('Server - should create MCP server instance', () => {
  // Set API key for test
  process.env['JIGX_API_KEY'] = 'test-key'

  const server = createJigxMcpServer()

  assert.ok(server, 'Server should be created')
  assert.strictEqual(typeof server.connect, 'function', 'Server should have connect method')

  // Clean up
  delete process.env['JIGX_API_KEY']
})
