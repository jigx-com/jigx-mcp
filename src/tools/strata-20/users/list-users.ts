import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Paging
  limit: z.string().optional().describe('Maximum number of results to return'),
  continuationToken: z.string().optional().describe('Token for pagination'),
  // Filters
  userIds: z.array(z.uuid()).optional().describe('Array of user IDs to filter'),
  search: z.string().optional().describe('Search term for users')
})

const OutputSchema = z.object({
  count: z.number().min(0),
  continuationToken: z.string().optional(),
  items: z.array(z.object({
    userId: z.uuid(),
    name: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    avatarUrl: z.string().optional(),
    defaultOrganizationId: z.uuid().optional(),
    status: z.string().optional(),
    statistics: z.object({}),
    // Audit
    createdAt: z.string(),
    createdBy: z.uuid(),
    updatedAt: z.string(),
    updatedBy: z.uuid()
  }))
})

const title = 'List Users'

// Tool definition
export const listUsersTool: Tool = {
  name: 'list_users',
  title,
  description: 'List users',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

export async function handleListUsers(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleListUsers: start')
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
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/users`)

    // Add query parameters
    Object.entries(validatedArgs).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'userIds' && Array.isArray(value)) {
          url.searchParams.append(key, value.join(','))
        } else {
          url.searchParams.append(key, String(value))
        }
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

    log.info('[MCP] handleListUsers: success', { duration: Date.now() - start })
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    }
  } catch (error) {
    log.error({ error }, '[MCP] handleListUsers: error')
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
