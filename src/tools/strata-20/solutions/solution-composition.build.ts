import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  solutionId: z.uuid().describe('The solution Id')
})

// Output schema - empty for POST request
const OutputSchema = z.object({})

const title = 'Build Solution Composite'

// Tool definition
export const buildSolutionCompositeTool: Tool = {
  name: 'build_solution_composite',
  title,
  description: 'Build solution composite',
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false, readOnlyHint: false, title },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

export async function handleBuildSolutionComposite(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleBuildSolutionComposite: start')
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

    // Extract path params, query params, and body
    const { organizationId, solutionId } = validatedArgs

    // Build URL
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/organizations/${organizationId}/solutions/${solutionId}/composition`)

    // Make API call with retry logic
    const response: CallToolResult = await withRetry(async () => {
      const request = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }

      log.debug({ url: url.toString(), ...request }, '[MCP] Sending request')
      const res = await fetch(url.toString(), request)

      // Success
      if (res.ok) {
        log.info('[MCP] handleBuildSolutionComposite: success', { duration: Date.now() - start })
        return {
          content: []
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
    log.error({ error }, '[MCP] handleBuildSolutionComposite: error')

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
