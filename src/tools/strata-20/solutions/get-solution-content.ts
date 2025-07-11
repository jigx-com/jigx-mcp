import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { URL } from 'node:url'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  solutionId: z.uuid().describe('The solution Id'),
  // Flags
  expandContent: z.boolean().optional().describe('Expand content information')
})

// TODO: Define output schema
const OutputSchema = z.object({
  // category: z.string(),
  // name: z.string(),
  // title: z.string(),
  // databases: z.object({
  //   default: z.object({
  //     databaseId: z.literal('default'),
  //     tables: z.record(z.string(), z.unknown()).nullable().optional()
  //   })
  // }).optional(),
  // stories: z.array(z.string()).optional()
})

const title = 'Get Solution Content'

// Tool definition
export const getSolutionContentTool: Tool = {
  name: 'get_solution_content',
  title,
  description: 'Get solution content',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

// Handler function
export async function handleGetSolutionContent(args: unknown): Promise<CallToolResult> {
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

    // Build URL properly
    const { organizationId, solutionId, expandContent } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/organizations/${organizationId}/solutions/${solutionId}/content`)

    // Add query parameters
    if (expandContent !== undefined) {
      url.searchParams.append('expandContent', String(expandContent))
    }

    // Make API call with retry logic
    const response = await withRetry(async () => {
      const request = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }

      console.error('[MCP] Sending request:', {
        url: url.toString(),
        ...request
      })

      const res = await fetch(url.toString(), request)

      if (!res.ok) {
        const errorText = await res.text()
        const error = new Error(`API request failed: ${res.status} ${res.statusText}`)
        ;(error as any).status = res.status
        ;(error as any).response = errorText
        throw error
      }

      return res.json()
    })

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    }
  } catch (error) {
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
