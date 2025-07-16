import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'
import { toInputSchema, toOutputSchema } from '../../utils/index.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  solutionId: z.uuid().describe('The solution Id'),

  // Request body
  content: z.looseObject({
    name: z.string().describe('Programmatic name. Immutable.'),
    title: z.string().describe('Friendly title'),
    category: z.string(), //.describe('Solution category'),
    description: z.string().optional(),

    databases: z.looseObject({}).optional().describe('Database configuration'),
    datasources: z.looseObject({}).optional().describe('Data sources configuration'),
    functions: z.looseObject({}).optional().describe('Functions configuration'),
    jigs: z.looseObject({}).optional().describe('Screens configuration')
  })

  // Query params
  // forceQueryRecompile: z.boolean().optional().describe('Force query recompilation')
})

// Output schema - empty for PUT request
const OutputSchema = z.object({})

const title = 'Set Solution Content'

// Tool definition
export const setSolutionContentTool: Tool = {
  name: 'set_solution_content',
  title,
  description: 'Set solution content',
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false, readOnlyHint: false, title },
  inputSchema: toInputSchema(InputSchema),
  outputSchema: toOutputSchema(OutputSchema)
}

export async function handleSetSolutionContent(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleSetSolutionContent: start')
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
    const { organizationId, solutionId, content } = validatedArgs

    // Build URL
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/organizations/${organizationId}/solutions/${solutionId}/content`)

    // Add query parameters
    // if (forceQueryRecompile !== undefined) {
    //   url.searchParams.append('forceQueryRecompile', String(forceQueryRecompile))
    // }

    // Make API call with retry logic
    const response: CallToolResult = await withRetry(async () => {
      const request = {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(content)
      }

      log.debug({ url: url.toString(), ...request }, '[MCP] Sending request')
      const res = await fetch(url.toString(), request)

      // Success
      if (res.ok) {
        log.info('[MCP] handleSetSolutionContent: success', { duration: Date.now() - start })
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
    log.error({ error }, '[MCP] handleSetSolutionContent: error')

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
