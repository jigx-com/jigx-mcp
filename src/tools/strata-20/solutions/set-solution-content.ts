import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  solutionId: z.uuid().describe('The solution Id'),
  // Request body
  category: z.string().describe('Solution category'),
  name: z.string().describe('Solution name'),
  title: z.string().describe('Solution title'),
  databases: z.object({
    default: z.object({
      databaseId: z.literal('default'),
      tables: z.record(z.string(), z.unknown()).nullable().optional()
    })
  }).optional().describe('Database configuration'),
  stories: z.array(z.string()).optional().describe('Array of story IDs'),
  // Query params
  forceQueryRecompile: z.boolean().optional().describe('Force query recompilation')
})

// Output schema - empty for PUT request
const OutputSchema = z.object({})

const title = 'Set Solution Content'

// Tool definition
export const setSolutionContentTool: Tool = {
  name: 'set_solution_content',
  title,
  description: 'Set solution content',
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false, readOnlyHint: false, title },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

export async function handleSetSolutionContent(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleSetSolutionContent: start')
  try {
    // Validate input with Zod
    const validatedArgs = InputSchema.parse(args)

    // Get auth manager
    const authManager = getAuth()
    const apiKey = authManager.getHeaders()['Authorization']?.replace('Bearer ', '')

    if (!apiKey) {
      return formatErrorResponse(
        new Error('API key not configured')
      )
    }

    // Extract path params, query params, and body
    const { organizationId, solutionId, forceQueryRecompile, ...bodyData } = validatedArgs

    // Build URL properly
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/organizations/${organizationId}/solutions/${solutionId}/content`)

    // Add query parameters
    if (forceQueryRecompile !== undefined) {
      url.searchParams.append('forceQueryRecompile', String(forceQueryRecompile))
    }

    // Make API call with retry logic
    const response = await withRetry(async () => {
      const request = {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyData)
      }

      console.error('[MCP] Sending request:', {
        url: url.toString(),
        method: request.method,
        headers: request.headers,
        body: bodyData
      })

      const res = await fetch(url.toString(), request)

      if (!res.ok) {
        const errorText = await res.text()
        return {
          content: [
            {
              type: 'text',
              text: `API request failed: ${res.status} ${res.statusText} - ${errorText}`
            }
          ]
        }
      }

      // PUT returns empty response on success
      return { success: true }
    })

    log.info('[MCP] handleSetSolutionContent: success', { duration: Date.now() - start })
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    }
  } catch (error) {
    log.error({ error }, '[MCP] handleSetSolutionContent: error')
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
    // Use the error handler to format the response
    return formatErrorResponse(error as Error)
  }
}
