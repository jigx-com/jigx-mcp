import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  solutionId: z.uuid().describe('The solution Id'),
  // Paging
  limit: z.string().optional().describe('Maximum number of results to return'),
  continuationToken: z.string().optional().describe('Token for pagination'),
  // Filters
  userIds: z.array(z.uuid()).optional().describe('Array of user IDs to filter'),
  emails: z.array(z.string().email()).optional().describe('Array of email addresses to filter'),
  search: z.string().optional().describe('Search term for members'),
  groupId: z.string().optional().describe('Filter by group Id'),
  includeRoles: z.array(z.enum(['OWNER', 'ADMIN', 'MAKER', 'USER', 'DENY'])).optional().describe('Include members with these roles'),
  excludeRoles: z.array(z.enum(['OWNER', 'ADMIN', 'MAKER', 'USER', 'DENY'])).optional().describe('Exclude members with these roles')
})

// TODO: Define output schema
const OutputSchema = z.object({
  count: z.number().min(0),
  continuationToken: z.string().optional(),
  items: z.array(z.object({
    userId: z.uuid(),
    name: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    userRole: z.enum(['OWNER', 'ADMIN', 'MAKER', 'USER', 'DENY']),
    groups: z.array(z.string()).optional(),
    createdAt: z.string(),
    updatedAt: z.string()
  }))
})

const title = 'List Solution Members'

// Tool definition
export const listSolutionMembersTool: Tool = {
  name: 'list_solution_members',
  title,
  description: 'List solution members',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

// Handler function
export async function handleListSolutionMembers(args: unknown): Promise<CallToolResult> {
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
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/organizations/${organizationId}/solutions/${solutionId}/members`)

    // Add query parameters
    Object.entries(queryOptions).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
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
