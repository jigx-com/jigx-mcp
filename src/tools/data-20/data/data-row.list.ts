import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'
import { ContinuationTokenSchema } from '../../utils/index.js'
import { DataRowSchema } from './data-row.zod.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  solutionId: z.uuid().describe('The solution Id'),
  tableId: z.string().describe('The table Id'),
  // Paging
  limit: z.int().min(1).optional().describe('Maximum number of results to return'),
  continuationToken: ContinuationTokenSchema.optional().describe('Token for pagination'),
  syncToken: ContinuationTokenSchema.optional().describe('Sync token for getting updates since last sync'),
  // Filters
  filter: z.string().optional().describe('Filter expression'),
  sort: z.string().optional().describe('Sort expression')
})

const OutputSchema = z.object({
  count: z.number().min(0),
  continuationToken: z.string().optional(),
  syncToken: z.string().optional(),
  items: z.array(DataRowSchema.extend({
    rid: z.string()
  }))
})

const title = 'List Data Rows'

// Tool definition
export const listDataRowsTool: Tool = {
  name: 'list_data_rows',
  title,
  description: 'List data rows from table',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

export async function handleListDataRows(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleListDataRows: start')
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
    const { organizationId, solutionId, tableId, ...queryOptions } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.DATA_V20}/organizations/${organizationId}/solutions/${solutionId}/databases/default/tables/${tableId}/rows`)

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

    log.info('[MCP] handleListDataRows: success', { duration: Date.now() - start })
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    }
  } catch (error) {
    log.error({ error }, '[MCP] handleListDataRows: error')
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
