import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  userId: z.uuid().describe('The user Id to retrieve'),
  // Flags
  expandRacl: z.boolean().optional().describe('Expand RACL (Resource Access Control List) information')
})

// TODO: Define output schema
const OutputSchema = z.object({
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
})

const title = 'Get User'

// Tool definition
export const getUserTool: Tool = {
  name: 'get_user',
  title,
  description: 'Get user',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

export async function handleGetUser(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleGetUser: start')
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
    const { userId, expandRacl } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/users/${userId}`)

    // Add query parameters
    if (expandRacl !== undefined) {
      url.searchParams.append('expandRacl', String(expandRacl))
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

    log.info('[MCP] handleGetUser: success', { duration: Date.now() - start })
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    }
  } catch (error) {
    log.error({ error }, '[MCP] handleGetUser: error')
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
