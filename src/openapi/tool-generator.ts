import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { getAuth } from '../auth/index.js'
import { formatErrorResponse, withRetry } from '../utils/error-handler.js'
import { OpenAPIParser } from './parser.js'

export interface GeneratedTool {
  tool: Tool
  handler: (args: any) => Promise<CallToolResult>
}

export class ToolGenerator {
  private readonly parser: OpenAPIParser
  private readonly apiVersion: 'v1' | 'data/v20' | 'tool/v20'

  constructor(specPath: string, apiVersion: 'v1' | 'data/v20' | 'tool/v20') {
    this.parser = new OpenAPIParser(specPath)
    this.apiVersion = apiVersion
  }

  /**
   * Generate MCP tools from OpenAPI spec
   */
  generateTools(): GeneratedTool[] {
    const tools = this.parser.generateTools()
    const { basePath } = this.parser.getServerConfig()

    return tools.map(toolDef => {
      // Create the MCP tool definition
      const tool: Tool = {
        name: toolDef.name,
        description: toolDef.description,
        inputSchema: z.toJSONSchema(toolDef.inputSchema) as Tool['inputSchema']
      }

      // Create the handler function
      const handler = this.createHandler(
        toolDef.metadata.path,
        toolDef.metadata.method,
        toolDef.inputSchema,
        basePath
      )

      return { tool, handler }
    })
  }

  /**
   * Create a handler function for a tool
   */
  private createHandler(
    path: string,
    method: string,
    inputSchema: z.ZodSchema<any>,
    basePath: string
  ): (args: any) => Promise<CallToolResult> {
    return async (args: any): Promise<CallToolResult> => {
      try {
        // Validate input
        const validatedArgs = inputSchema.parse(args)

        // Get auth headers
        const auth = getAuth()
        const headers = auth.getHeaders()

        // Build URL with path parameters
        let url = path
        for (const [key, value] of Object.entries(validatedArgs)) {
          if (typeof value === 'string' && url.includes(`{${key}}`)) {
            url = url.replace(`{${key}}`, encodeURIComponent(value))
            delete validatedArgs[key]
          }
        }

        // Build full URL
        const baseUrl = auth.getBaseUrl(this.apiVersion)
        let fullUrl = `${baseUrl}${basePath ? `/${basePath}` : ''}${url}`

        // Add query parameters
        if (validatedArgs.query && Object.keys(validatedArgs.query).length > 0) {
          const queryString = new URLSearchParams(validatedArgs.query).toString()
          fullUrl += `?${queryString}`
        }

        // Prepare request options
        const options: RequestInit = {
          method: method.toUpperCase(),
          headers
        }

        // Add body if present
        if (validatedArgs.body) {
          options.body = JSON.stringify(validatedArgs.body)
        }

        // Make the request with retry logic
        const makeRequest = async () => {
          const response = await fetch(fullUrl, options)
          const responseData = await response.json()

          // Handle errors
          if (!response.ok) {
            const error: any = new Error(`API request failed: ${response.statusText}`)
            error.statusCode = response.status
            error.response = responseData
            // Convert headers to plain object
            const headersObj: Record<string, string> = {}
            response.headers.forEach((value, key) => {
              headersObj[key] = value
            })
            error.headers = headersObj
            throw error
          }

          return responseData
        }

        const responseData = await withRetry(makeRequest)

        // Return success response
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(responseData, null, 2)
            }
          ]
        }
      } catch (error) {
        return formatErrorResponse(error)
      }
    }
  }
}
