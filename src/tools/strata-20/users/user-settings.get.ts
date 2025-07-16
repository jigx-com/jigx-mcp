import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  userId: z.uuid().describe('The user Id')
})

// TODO: Define output schema
const OutputSchema = z.object({
  // preferences: z.object({
  //   theme: z.enum(['light', 'dark', 'auto']).optional(),
  //   language: z.string().optional(),
  //   timezone: z.string().optional(),
  //   notifications: z.object({
  //     email: z.boolean().optional(),
  //     push: z.boolean().optional(),
  //     sms: z.boolean().optional()
  //   }).optional()
  // }).optional(),
  // custom: z.object({}).optional()
})

const title = 'Get User Settings'

// Tool definition
export const getUserSettingsTool: Tool = {
  name: 'get_user_settings',
  title,
  description: 'Get user settings',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

export async function handleGetUserSettings(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleGetUserSettings: start')
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
    const { userId } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/users/${userId}/settings`)

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

        log.info('[MCP] handleGetUserSettings: success', { duration: Date.now() - start })
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
    log.error({ error }, '[MCP] handleGetUserSettings: error')

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
