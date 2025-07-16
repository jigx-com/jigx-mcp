import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'
import { ContinuationTokenSchema, toInputSchema, toOutputSchema } from '../../utils/index.js'
import { UserSchema } from './user.zod.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Paging
  limit: z.int().min(1).max(500).optional().describe('Max result count, default 25 max 500'),
  continuationToken: ContinuationTokenSchema.optional().describe('Token for pagination'),
  // Filters
  userIds: z.array(z.uuid()).optional().describe('Array of user Ids to filter'),
  search: z.string().optional().describe('Search term for users')
})

const OutputSchema = z.object({
  count: z.number().min(0),
  continuationToken: z.string().optional(),
  items: z.array(UserSchema)
})

const title = 'List Users'

// Tool definition
export const listUsersTool: Tool = {
  name: 'list_users',
  title,
  description: 'List users (USRs)',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: toInputSchema(InputSchema),
  outputSchema: toOutputSchema(OutputSchema)
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

    // Build URL
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
    const response: CallToolResult = await withRetry(async () => {
      const request = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }

      log.debug({ url: url.toString(), ...request }, '[MCP] Sending request')
      const res = await fetch(url.toString(), request)

      // Success
      if (res.ok) {
        const json = await res.json()

        log.info('[MCP] handleListUsers: success', { duration: Date.now() - start })
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(json)
          }]
        } satisfies CallToolResult
      }

      // Error
      const errorText = await res.text()
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `API request failed: ${res.status} ${res.statusText} - ${errorText}`
        }]
      } satisfies CallToolResult
    })

    return response
  } catch (error) {
    log.error({ error }, '[MCP] handleListUsers: error')

    if (error instanceof z.ZodError) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Validation error: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        }]
      }
    }

    // Use the error handler to format the response
    return formatErrorResponse(error as Error)
  }
}
