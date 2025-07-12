import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'
import { OrganizationSchema } from './organization.zod.js'

const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The Id of the organization to retrieve'),
  // Flags
  expandContent: z.boolean().optional().describe('Expand content information'),
  expandAuth: z.boolean().optional().describe('Expand authentication information'),
  expandDomains: z.boolean().optional().describe('Expand domain information'),
  expandSettings: z.boolean().optional().describe('Expand settings information'),
  expandTags: z.boolean().optional().describe('Expand tags')
})

const OutputSchema = OrganizationSchema

const title = 'Get Organization'

// Tool definition
export const getOrganizationTool: Tool = {
  name: 'get_organization',
  title,
  // description: 'Get organization',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

export async function handleGetOrganization(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleGetOrganization: start')
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
    const { organizationId, ...queryOptions } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/organizations/${organizationId}`)

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

      log.debug({ url: url.toString(), ...request }, '[MCP] Sending request')
      const res: Response = await fetch(url.toString(), request)

      // 200 OK
      if (res.ok) {
        return res.json()
      }

      // Handle error response
      const errorText: string = await res.text()
      return {
        content: [{
          type: 'text',
          text: `API request failed: ${res.status} ${res.statusText} - ${errorText}`
        }] satisfies CallToolResult['content']
      }
    })

    // Validate output
    let parsed
    try {
      parsed = OutputSchema.parse(response)
    } catch (outputError) {
      return formatErrorResponse(new Error('Output validation failed: ' + (outputError instanceof z.ZodError ? outputError.issues?.map((e: z.ZodIssue) => e.message).join(', ') : String(outputError))))
    }

    log.info('[MCP] handleGetOrganization: success', { duration: Date.now() - start })
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(parsed)
      }] satisfies CallToolResult['content']
    }
  } catch (error) {
    log.error({ error }, '[MCP] handleGetOrganization: error')

    if (error instanceof z.ZodError) {
      return {
        content: [{
          type: 'text',
          text: `Validation error: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        }] satisfies CallToolResult['content']
      }
    }

    // Use the error handler to format the response
    return formatErrorResponse(error as Error)
  }
}
