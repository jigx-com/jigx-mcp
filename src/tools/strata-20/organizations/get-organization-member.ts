import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  userId: z.uuid().describe('The user Id to retrieve')
})

const OutputSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
  region: z.string(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  avatarUrl: z.string().optional(),
  userRole: z.enum(['OWNER', 'ADMIN', 'MAKER', 'USER', 'DENY']),
  userStatus: z.string(),
  // Audit
  createdAt: z.string(),
  createdBy: z.uuid(),
  updatedAt: z.string(),
  updatedBy: z.uuid()
})

const title = 'Get Organization Member'

// Tool definition
export const getOrganizationMemberTool: Tool = {
  name: 'get_organization_member',
  title,
  description: 'Get organization member',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

// Handler function
export async function handleGetOrganizationMember(args: unknown): Promise<CallToolResult> {
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
    const { organizationId, userId } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/organizations/${organizationId}/members/${userId}`)

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
