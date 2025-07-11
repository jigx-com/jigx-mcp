import { readFileSync } from 'node:fs'
import { z } from 'zod'

// OpenAPI 3.0.1 types
export interface OpenAPISpec {
  readonly openapi: string
  readonly info: {
    readonly title: string
    readonly version: string
  }
  readonly servers: ReadonlyArray<{
    readonly url: string
    readonly variables?: Record<string, { readonly default: string }>
  }>
  readonly paths: Record<string, PathItem>
  readonly components?: {
    readonly schemas?: Record<string, SchemaObject>
    readonly securitySchemes?: Record<string, any>
  }
}

export interface PathItem {
  readonly get?: Operation
  readonly post?: Operation
  readonly put?: Operation
  readonly delete?: Operation
  readonly patch?: Operation
  readonly options?: Operation
  readonly head?: Operation
}

export interface Operation {
  readonly operationId: string
  readonly summary?: string
  readonly description?: string
  readonly parameters?: readonly Parameter[]
  readonly requestBody?: RequestBody
  readonly responses: Record<string, Response>
  readonly security?: ReadonlyArray<Record<string, readonly any[]>>
  readonly tags?: readonly string[]
}

export interface Parameter {
  readonly name: string
  readonly in: 'query' | 'header' | 'path' | 'cookie'
  readonly description?: string
  readonly required?: boolean
  readonly schema?: SchemaObject
}

export interface RequestBody {
  description?: string
  required?: boolean
  content: Record<string, MediaType>
}

export interface MediaType {
  schema?: SchemaObject
}

export interface Response {
  description: string
  content?: Record<string, MediaType>
}

export interface SchemaObject {
  type?: string
  properties?: Record<string, SchemaObject>
  items?: SchemaObject
  required?: string[]
  enum?: any[]
  format?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  default?: any
  nullable?: boolean
  oneOf?: SchemaObject[]
  anyOf?: SchemaObject[]
  allOf?: SchemaObject[]
  $ref?: string
}

export class OpenAPIParser {
  private readonly spec: OpenAPISpec
  private readonly schemas: Map<string, SchemaObject> = new Map()

  constructor(specPath: string) {
    const content = readFileSync(specPath, 'utf-8')
    this.spec = JSON.parse(content)
    this.indexSchemas()
  }

  private indexSchemas(): void {
    if (this.spec.components?.schemas) {
      for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
        this.schemas.set(`#/components/schemas/${name}`, schema)
      }
    }
  }

  /**
   * Convert operationId to snake_case tool name
   */
  private toSnakeCase(operationId: string): string {
    return operationId
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/__+/g, '_')
  }

  /**
   * Resolve $ref references in schemas
   */
  private resolveRef(ref: string): SchemaObject {
    const schema = this.schemas.get(ref)
    if (!schema) {
      throw new Error(`Cannot resolve reference: ${ref}`)
    }
    return this.resolveSchema(schema)
  }

  /**
   * Resolve all references in a schema object
   */
  private resolveSchema(schema: SchemaObject | null | undefined): SchemaObject {
    if (!schema) {
      return { type: 'null' }
    }

    if (schema.$ref) {
      return this.resolveRef(schema.$ref)
    }

    const resolved: SchemaObject = { ...schema }

    if (schema.properties) {
      resolved.properties = {}
      for (const [key, value] of Object.entries(schema.properties)) {
        resolved.properties[key] = this.resolveSchema(value)
      }
    }

    if (schema.items) {
      resolved.items = this.resolveSchema(schema.items)
    }

    if (schema.oneOf) {
      resolved.oneOf = schema.oneOf.map(s => this.resolveSchema(s))
    }

    if (schema.anyOf) {
      resolved.anyOf = schema.anyOf.map(s => this.resolveSchema(s))
    }

    if (schema.allOf) {
      resolved.allOf = schema.allOf.map(s => this.resolveSchema(s))
    }

    return resolved
  }

  /**
   * Convert OpenAPI schema to Zod schema
   */
  private schemaToZod(schema: SchemaObject, isRequired = true): z.ZodSchema<any> {
    const resolved = this.resolveSchema(schema)

    switch (resolved.type) {
      case 'string':
        let stringSchema = z.string()
        if (resolved.minLength) stringSchema = stringSchema.min(resolved.minLength)
        if (resolved.maxLength) stringSchema = stringSchema.max(resolved.maxLength)
        if (resolved.pattern) stringSchema = stringSchema.regex(new RegExp(resolved.pattern))
        if (resolved.enum && resolved.enum.length > 0) {
          return isRequired ? z.enum(resolved.enum as [string, ...string[]]) : z.enum(resolved.enum as [string, ...string[]]).optional()
        }
        if (resolved.format === 'date-time') stringSchema = stringSchema.datetime()
        if (resolved.format === 'email') stringSchema = stringSchema.email()
        if (resolved.format === 'url') stringSchema = stringSchema.url()
        return isRequired ? stringSchema : stringSchema.optional()

      case 'number':
      case 'integer':
        let numberSchema = resolved.type === 'integer' ? z.number().int() : z.number()
        if (resolved.minimum !== undefined) numberSchema = numberSchema.min(resolved.minimum)
        if (resolved.maximum !== undefined) numberSchema = numberSchema.max(resolved.maximum)
        return isRequired ? numberSchema : numberSchema.optional()

      case 'boolean':
        return isRequired ? z.boolean() : z.boolean().optional()

      case 'array':
        if (!resolved.items) {
          return isRequired ? z.array(z.any()) : z.array(z.any()).optional()
        }
        const itemSchema = this.schemaToZod(resolved.items)
        return isRequired ? z.array(itemSchema) : z.array(itemSchema).optional()

      case 'object':
        if (!resolved.properties) {
          return isRequired ? z.record(z.string(), z.any()) : z.record(z.string(), z.any()).optional()
        }

        const shape: Record<string, z.ZodSchema<any>> = {}
        const required = resolved.required || []

        for (const [key, propSchema] of Object.entries(resolved.properties)) {
          shape[key] = this.schemaToZod(propSchema, required.includes(key))
        }

        const objectSchema = z.object(shape)
        return isRequired ? objectSchema : objectSchema.optional()

      default:
        return isRequired ? z.any() : z.any().optional()
    }
  }

  /**
   * Generate tool definition for an operation
   */
  private generateTool(path: string, method: string, operation: Operation): {
    name: string
    description: string
    inputSchema: z.ZodSchema<any>
    metadata: {
      path: string
      method: string
      operationId: string
    }
  } {
    const toolName = this.toSnakeCase(operation.operationId)
    const description = operation.summary || operation.description || `${method.toUpperCase()} ${path}`

    // Build input schema from parameters and request body
    const shape: Record<string, z.ZodSchema<any>> = {}

    // Add path parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (param.in === 'path' && param.schema) {
          shape[param.name] = this.schemaToZod(param.schema, param.required !== false)
            .describe(param.description || param.name)
        }
      }
    }

    // Add query parameters
    const queryShape: Record<string, z.ZodSchema<any>> = {}
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (param.in === 'query' && param.schema) {
          queryShape[param.name] = this.schemaToZod(param.schema, param.required === true)
            .describe(param.description || param.name)
        }
      }
    }
    if (Object.keys(queryShape).length > 0) {
      shape['query'] = z.object(queryShape).optional()
    }

    // Add request body
    if (operation.requestBody?.content?.['application/json']?.schema) {
      const bodySchema = operation.requestBody.content['application/json'].schema
      shape['body'] = this.schemaToZod(bodySchema, operation.requestBody.required === true)
        .describe(operation.requestBody.description || 'Request body')
    }

    const inputSchema = z.object(shape)

    return {
      name: toolName,
      description,
      inputSchema,
      metadata: {
        path,
        method,
        operationId: operation.operationId
      }
    }
  }

  /**
   * Parse the spec and generate all tools
   */
  generateTools(): Array<ReturnType<typeof this.generateTool>> {
    const tools: Array<ReturnType<typeof this.generateTool>> = []

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (method === 'options' || method === 'head') continue
        if (operation && typeof operation === 'object' && 'operationId' in operation) {
          tools.push(this.generateTool(path, method, operation as Operation))
        }
      }
    }

    return tools
  }

  /**
   * Get server configuration
   */
  getServerConfig(): { baseUrl: string; basePath: string } {
    const server = this.spec.servers?.[0]
    if (!server) {
      throw new Error('No servers defined in OpenAPI spec')
    }

    const basePath = server.variables?.['basePath']?.default || ''
    const baseUrl = server.url.replace('/{basePath}', '')

    return { baseUrl, basePath }
  }
}
