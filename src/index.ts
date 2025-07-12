#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createJigxMcpServer } from './server/index.js'

async function main(): Promise<void> {
  const server = createJigxMcpServer()
  const transport = new StdioServerTransport()

  await server.connect(transport)
  console.error('[MCP] Jigx MCP server running on stdio')
}

main().catch(error => {
  console.error('[MCP] Failed to start server:', error)
  process.exit(1)
})
