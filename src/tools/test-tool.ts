import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { HandlerDeps } from '../types/handler-deps'

// Define input schema with Zod
const TestToolSchema = z.object({
  message: z.string().describe('A test message'),
  optional: z.string().optional().describe('An optional parameter')
})

// Tool definition
export const testTool: Tool = {
  name: 'test_tool',
  description: 'A simple test tool to verify MCP server is working',
  inputSchema: z.toJSONSchema(TestToolSchema) as Tool['inputSchema']
}

// Handler function
export async function handleTestTool(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleTestTool: start')
  try {
    // Validate input with Zod
    const validatedArgs = TestToolSchema.parse(args)

    log.info('[MCP] handleTestTool: success', { duration: Date.now() - start })
    return {
      content: [
        {
          type: 'text',
          text: `Test response: ${validatedArgs.message}${validatedArgs.optional ? ` (optional: ${validatedArgs.optional})` : ''}`
        }
      ]
    }
  } catch (error) {
    log.error({ error }, '[MCP] handleTestTool: error')
    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text',
            text: `Validation error: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          }
        ]
      }
    }
    return {
      content: [
        {
          type: 'text',
          text: `Failed to execute test tool: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    }
  }
}
