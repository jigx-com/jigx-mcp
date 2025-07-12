import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  // Paging
  limit: z.string().optional().describe('Maximum number of results to return'),
  continuationToken: z.string().optional().describe('Token for pagination'),
  // Filters
  userIds: z.array(z.uuid()).optional().describe('Array of user IDs to filter'),
  emails: z.array(z.string().email()).optional().describe('Array of email addresses to filter'),
  search: z.string().optional().describe('Search term for members'),
  includeRoles: z.array(z.enum(['OWNER', 'ADMIN', 'MAKER', 'USER', 'DENY'])).optional().describe('Include members with these roles'),
  excludeRoles: z.array(z.enum(['OWNER', 'ADMIN', 'MAKER', 'USER', 'DENY'])).optional().describe('Exclude members with these roles')
})

// TODO: Define output schema
const OutputSchema = z.object({
  count: z.number().min(0),
  continuationToken: z.string().optional(),
  items: z.array(z.object({
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
  }))
})

const title = 'List Organization Members'

// Tool definition
export const listOrganizationMembersTool: Tool = {
  name: 'list_organization_members',
  title,
  description: 'List organization members',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

// Handler function
// Handler function
export async function handleListOrganizationMembers(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleListOrganizationMembers: start')
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
    const { organizationId, ...queryOptions } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/organizations/${organizationId}/members`)

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

      log.debug({ url: url.toString(), ...request }, '[MCP] Sending request')
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

    // Validate output with OutputSchema
    let validatedResponse
    try {
      validatedResponse = OutputSchema.parse(response)
    } catch (outputError) {
      return formatErrorResponse(new Error('Output validation failed: ' + (outputError instanceof z.ZodError ? outputError.issues?.map((e: z.ZodIssue) => e.message).join(', ') : String(outputError))))
    }

    log.info('[MCP] handleListOrganizationMembers: success', { duration: Date.now() - start })
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(validatedResponse, null, 2)
        }
      ]
    }
  } catch (error) {
    log.error({ error }, '[MCP] handleListOrganizationMembers: error')
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
