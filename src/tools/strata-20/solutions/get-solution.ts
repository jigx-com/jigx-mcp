import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  solutionId: z.uuid().describe('The solution Id to retrieve'),
  // Flags
  expandContent: z.boolean().optional().describe('Expand content information'),
  expandSettings: z.boolean().optional().describe('Expand settings information'),
  expandTags: z.boolean().optional().describe('Expand tags')
})

// TODO: Define output schema
const OutputSchema = z.object({
  organizationId: z.uuid(),
  solutionId: z.uuid(),
  region: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string().optional(),
  category: z.string(),
  locked: z.boolean().optional(),
  jacl: z.object().optional(),
  groups: z.array(z.string()).optional(),
  // Audit
  createdAt: z.string(),
  createdBy: z.uuid(),
  updatedAt: z.string(),
  updatedBy: z.uuid()
})

const title = 'Get Solution'

// Tool definition
export const getSolutionTool: Tool = {
  name: 'get_solution',
  title,
  description: 'Get solution',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

export async function handleGetSolution(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleGetSolution: start')
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
    const { organizationId, solutionId, ...queryOptions } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/organizations/${organizationId}/solutions/${solutionId}`)

    // Add query parameters
    Object.entries(queryOptions).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })

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
        return {
          content: [
            {
              type: 'text',
              text: `API request failed: ${res.status} ${res.statusText} - ${errorText}`
            }
          ]
        }
      }

      return res.json()
    })

    log.info('[MCP] handleGetSolution: success', { duration: Date.now() - start })
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    }
  } catch (error) {
    log.error({ error }, '[MCP] handleGetSolution: error')
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
