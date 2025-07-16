import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'
import { toInputSchema, toOutputSchema } from '../../utils/index.js'
import { UserSchema } from './user.zod.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  userId: z.uuid().describe('The user Id to retrieve'),
  // Flags
  expandRacl: z.boolean().optional().describe('Expand RACL (Resource Access Control List) information')
})

const OutputSchema = UserSchema.omit({
  userId: true
})

const title = 'Get User'

// Tool definition
export const getUserTool: Tool = {
  name: 'get_user',
  title,
  description: 'Get user (USR)',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: toInputSchema(InputSchema),
  outputSchema: toOutputSchema(OutputSchema)
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

    // Build URL
    const { userId, expandRacl } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/users/${userId}`)

    // Add query parameters
    if (expandRacl !== undefined) {
      url.searchParams.append('expandRacl', String(expandRacl))
    }

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

        // Validate output
        let parsed
        try {
          parsed = OutputSchema.parse(json)
        } catch (outputError) {
          return formatErrorResponse(new Error('Output validation failed: ' + (outputError instanceof z.ZodError ? outputError.issues?.map((e: z.ZodIssue) => e.message).join(', ') : String(outputError))))
        }

        log.info('[MCP] handleGetUser: success', { duration: Date.now() - start })
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(parsed)
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
    log.error({ error }, '[MCP] handleGetUser: error')

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
