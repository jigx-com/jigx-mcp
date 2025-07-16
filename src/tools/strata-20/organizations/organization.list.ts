import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'
import { ContinuationTokenSchema, RegionSchema, toInputSchema, toOutputSchema } from '../../utils/index.js'
import { OrganizationSchema } from './organization.zod.js'

const InputSchema = z.object({
  // Paging
  limit: z.int().min(1).max(500).optional().describe('Max result count, default 25 max 500'),
  continuationToken: ContinuationTokenSchema.optional().describe('Token for pagination'),
  // Filters
  // filterMode: z.enum(['MY', 'ALL']).optional().describe('Filter mode for organizations (MY or ALL)'),
  region: RegionSchema.optional().describe('Filter by region'),
  organizationIds: z.array(z.uuid()).optional().describe('Comma-separated list of organization Ids'),
  search: z.string().optional().describe('Search term for organizations'),
  // Flags
  // expandAuth: z.boolean().optional().describe('Expand authentication information'),
  // expandDomains: z.boolean().optional().describe('Expand domain information'),
  expandSettings: z.boolean().optional().describe('Expand settings information'),
  // expandTags: z.boolean().optional().describe('Expand tags')
})

const OutputSchema = z.object({
  count: z.number().min(0),
  continuationToken: z.string().optional(),
  items: z.array(OrganizationSchema)
})

const title = 'List Organizations'

// Tool definition
export const listOrganizationsTool: Tool = {
  name: 'list_organizations',
  title,
  description: 'List organizations (ORGs)',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: toInputSchema(InputSchema),
  outputSchema: toOutputSchema(OutputSchema)
}

// Handler function
export async function handleListOrganizations(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleListOrganizations: start')
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
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/organizations`)

    // Add query parameters
    Object.entries(validatedArgs).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
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

        // Validate output
        let parsed
        try {
          parsed = OutputSchema.parse(json)
        } catch (outputError) {
          return formatErrorResponse(new Error('Output validation failed: ' + (outputError instanceof z.ZodError ? outputError.issues?.map((e: z.ZodIssue) => e.message).join(', ') : String(outputError))))
        }

        log.info('[MCP] handleListOrganizations: success', { duration: Date.now() - start })
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
    log.error({ error }, '[MCP] handleListOrganizations: error')

    if (error instanceof z.ZodError) {
      return {
        isError: true,
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
