import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import type { HandlerDeps } from '../../../types/handler-deps.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

const MAX_COMPOSITE_SOURCES = 2
// const AllCompositeMergeConfigTypes: readonly string[] = ['skip', 'replace', 'fail']
// const AllCompositeTriggerTypes: readonly string[] = ['manual', 'immediate', 'none'] as const
// const _triggerSchema = z.union([
//   z.number().min(0).max(86400), // seconds (max 24 hours)
//   z.enum(AllCompositeTriggerTypes)
// ]).default('immediate').describe('Trigger type for composite solution updates')

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  solutionId: z.uuid().describe('The solution Id'),

  // Request body
  primary: z.object({
    organizationId: z.uuid(),
    solutionId: z.uuid()
  }),

  modules: z.array(
    z.object({
      organizationId: z.uuid(),
      solutionId: z.uuid()
      // includePatterns: z.array(z.string()).optional(),
      // excludePatterns: z.array(z.string()).optional()
    })
  ).min(1).max(MAX_COMPOSITE_SOURCES)

  // trigger: z.object({
  //   onPrimaryUpdate: _triggerSchema,
  //   onModuleUpdate: _triggerSchema
  // }),

  // merge: z.object({
  //   functions: z.enum(AllCompositeMergeConfigTypes).default('skip'),
  //   datasources: z.enum(AllCompositeMergeConfigTypes).default('skip'),
  //   jigs: z.enum(AllCompositeMergeConfigTypes).default('skip')
  // })
})

// Output schema - empty for PUT request
const OutputSchema = z.object({})

const title = 'Merge Solution Composite'

// Tool definition
export const mergeSolutionCompositeTool: Tool = {
  name: 'merge_solution_composite',
  title,
  description: 'Merge solution composite',
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false, readOnlyHint: false, title },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

export async function handleMergeSolutionComposite(args: unknown, deps: HandlerDeps): Promise<CallToolResult> {
  const log = deps.logger
  const start = Date.now()
  log.info({ args }, '[MCP] handleMergeSolutionComposite: start')
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
    const { organizationId, solutionId, ...bodyData } = validatedArgs

    // Build URL
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.STRATA_V20}/organizations/${organizationId}/solutions/${solutionId}/composition`)

    // Make API call with retry logic
    const response: CallToolResult = await withRetry(async () => {
      const request = {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...bodyData,
          trigger: { onPrimaryUpdate: 'immediate', onModuleUpdate: 'immediate' },
          merge: { functions: 'skip', datasources: 'skip', jigs: 'skip' }
        })
      }

      log.debug({ url: url.toString(), ...request }, '[MCP] Sending request')
      const res = await fetch(url.toString(), request)

      // Success
      if (res.ok) {
        log.info('[MCP] handleMergeSolutionComposite: success', { duration: Date.now() - start })
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
    log.error({ error }, '[MCP] handleMergeSolutionComposite: error')

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
