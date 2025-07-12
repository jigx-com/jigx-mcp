import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
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

// Handler function
export async function handleGetUserSettings(args: unknown): Promise<CallToolResult> {
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
    const { userId } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/users/${userId}/settings`)

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
