import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import * as z from 'zod'
import { getAuth } from '../../../auth/index.js'
import { API_BASE_URL, API_VERSIONS } from '../../../CONSTANTS.js'
import { formatErrorResponse, withRetry } from '../../../utils/error-handler.js'

// Define input schema with Zod
const InputSchema = z.object({
  // Required
  organizationId: z.uuid().describe('The organization Id'),
  solutionId: z.uuid().describe('The solution Id')
})

// TODO: Define output schema
const OutputSchema = z.object({
  // databaseId: z.literal('default'),
  // tables: z.array(z.object({
  //   tableId: z.string(),
  //   tableName: z.string(),
  //   schema: z.object({
  //     columns: z.array(z.object({
  //       name: z.string(),
  //       type: z.string(),
  //       required: z.boolean().optional(),
  //       unique: z.boolean().optional()
  //     }))
  //   }).optional(),
  //   rowCount: z.number().optional()
  // }))
})

const title = 'Get Database'

// Tool definition
export const getDatabaseTool: Tool = {
  name: 'get_database',
  title,
  description: 'Get database schema',
  annotations: { title, destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema'],
  outputSchema: z.toJSONSchema(OutputSchema) as Tool['outputSchema']
}

// Handler function
export async function handleGetDatabase(args: unknown): Promise<CallToolResult> {
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
    const { organizationId, solutionId } = validatedArgs
    const url = new URL(`${API_BASE_URL}/${API_VERSIONS.DATA_V20}/organizations/${organizationId}/solutions/${solutionId}/databases/default`)

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
