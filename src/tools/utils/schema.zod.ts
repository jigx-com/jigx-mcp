import type { Tool } from '@modelcontextprotocol/sdk/types'
import * as z from 'zod'

// Mitigate error due to Zod v4 schemas (which newly adds "$schema" property to all JSON Schema outputs:
// ERROR: MCP server my-mcp-server has tools with invalid parameters which will be omitted.
// https://github.com/microsoft/vscode/issues/251315#issue-3141411853

export function toInputSchema(schema: z.ZodTypeAny): Tool['inputSchema'] {
  const { $schema: _, ...rest } = z.toJSONSchema(schema)
  return rest as Tool['inputSchema']
}

export function toOutputSchema(schema: z.ZodTypeAny): Tool['outputSchema'] {
  const { $schema: _, ...rest } = z.toJSONSchema(schema)
  return rest as Tool['outputSchema']
}
