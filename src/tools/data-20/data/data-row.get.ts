import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'
import { toInputSchema, toOutputSchema } from '../../utils/index.js'
import { DataRowSchema } from './data-row.zod.js'

// Define input schema with Zod
const InputSchema = z.looseObject({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  solutionId: z.uuid().describe('The solution Id'),
  tableId: z.string().describe('The table Id'),
  rid: z.string().describe('The row Id')
})

const OutputSchema = DataRowSchema.omit({
  rid: true
})

const title = 'Get Data Row'

// Tool definition
export const getDataRowTool: Tool = {
  name: 'get_data_row',
  title,
  description: 'Get data row',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: toInputSchema(InputSchema),
  outputSchema: toOutputSchema(OutputSchema)
}

// Handler function
export async function handleGetDataRow(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleGetDataRow: start')
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
    const { organizationId, solutionId, tableId, rid } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.DATA_V20}/organizations/${organizationId}/solutions/${solutionId}/databases/default/tables/${tableId}/rows/${rid}`)

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

        log.info('[MCP] handleGetDataRow: success', { duration: Date.now() - start })
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
    log.error({ error }, '[MCP] handleGetDataRow: error')

    if (error instanceof z.ZodError) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Validation error: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        }]
      }
    }

    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Failed to get data row: ${error instanceof Error ? error.message : String(error)}`
      }]
    }
  }
}
