# Jigx MCP Server - Product Requirements Document

## Overview
The Jigx MCP (Model Context Protocol) Server provides AI assistants with direct access to Jigx's low-code mobile app development platform APIs. This enables AI tools like Claude to interact with Jigx services for creating, managing, and deploying mobile applications programmatically. The server acts as a bridge between AI assistants and the Jigx platform, enabling developers to leverage AI for rapid mobile app development workflows.

## Core Features

### 1. REST API Integration
- **What it does**: Exposes Jigx REST APIs (v1, data-api-20, tool-api-20) as MCP tools
- **Why it's important**: Enables AI assistants to perform CRUD operations on Jigx resources
- **How it works**: Translates OpenAPI specifications into MCP tool definitions with proper authentication

### 2. Authentication Management
- **What it does**: Handles JIGX_API_KEY authentication for all API requests
- **Why it's important**: Ensures secure access to Jigx platform resources
- **How it works**: Reads API key from environment variables or MCP configuration, attaches to request headers

### 3. Tool Generation from OpenAPI
- **What it does**: Automatically generates MCP tools from Swagger/OpenAPI specifications
- **Why it's important**: Maintains consistency between API documentation and MCP tools
- **How it works**: Parses OpenAPI JSON files and creates typed MCP tool definitions with proper schemas

### 4. Error Handling & Retries
- **What it does**: Provides robust error handling with meaningful messages
- **Why it's important**: Helps developers understand and fix issues quickly
- **How it works**: Catches API errors, network failures, and validation errors with contextual information

### 5. Resource Management Tools
- **What it does**: Provides high-level tools for common Jigx workflows
- **Why it's important**: Simplifies complex multi-step operations
- **How it works**: Combines multiple API calls into semantic operations (e.g., "deploy app", "sync data")

## User Experience

### User Personas
1. **AI-Assisted Developer**: Uses Claude/ChatGPT to build Jigx apps through natural language
2. **Automation Engineer**: Integrates Jigx operations into AI-powered workflows
3. **Low-Code Developer**: Leverages AI to accelerate Jigx app development

### Key User Flows
1. **App Creation**: "Create a new Jigx app with a login screen and dashboard"
2. **Data Management**: "Import this CSV data into my Jigx app's database"
3. **Deployment**: "Deploy my app to production with the latest changes"

### UI/UX Considerations
- Clear, descriptive tool names that map to user intentions
- Comprehensive error messages with suggested fixes
- Progress indicators for long-running operations
- Validation of inputs before API calls

## Technical Architecture

### System Components
```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   AI Assistant  │────▶│  MCP Server  │────▶│  Jigx APIs  │
│  (Claude, etc)  │◀────│  (jigx-mcp)  │◀────│   (REST)    │
└─────────────────┘     └──────────────┘     └─────────────┘
```

### Data Models
- **Tool Definitions**: Generated from OpenAPI specs with Zod schemas
- **Request/Response Types**: TypeScript interfaces matching API contracts
- **Configuration**: API keys, base URLs, retry policies
- **Validation**: Use Zod for all input/output validation with its built-in JSON Schema generation for MCP tool schema descriptions

### APIs and Integrations
1. **Jigx REST API v1**: Core platform operations
   - Base URL: `https://api.jigx.com/v1`
   - Key endpoints:
     - `/organizations` - Manage organizations
     - `/organizations/{id}/solutions` - Solution management
     - `/organizations/{id}/members` - Member management
     - `/organizations/{id}/solutions/{id}/databases` - Database operations
     - `/organizations/{id}/notifications` - Notifications
   - Authentication: Bearer token via JIGX_API_KEY header
2. **Data API v20**: Database and data management
   - Base URL: `https://api.jigx.com/data/v20`
   - Purpose: Direct database operations and data queries
   - Authentication: Same as v1 API
3. **Tool API v20**: Development tools and utilities
   - Base URL: `https://api.jigx.com/tool/v20`
   - Purpose: Development and deployment tools
   - Authentication: Same as v1 API

### Infrastructure Requirements
- Node.js 20+ runtime
- Network access to Jigx APIs
- Secure storage for API keys
- MCP-compatible AI assistant

## Development Roadmap

### Phase 1: MVP Foundation
- Set up TypeScript project with MCP SDK
- Implement authentication handling
- Create OpenAPI parser for tool generation
- Build core request/response handling with Zod validation
- Add basic error handling
- Create initial test suite
- Set up Zod schema to JSON Schema conversion for MCP tool definitions

### Phase 2: Core Tools Implementation
- Generate tools from jigx-rest-api-v1 spec
- Implement data-api-20 tools
- Implement tool-api-20 tools
- Add request validation with Zod
- Implement retry logic for transient failures
- Create comprehensive test coverage

### Phase 3: Enhanced Functionality
- Add high-level workflow tools
- Implement response caching
- Add request batching capabilities
- Create tool documentation generator
- Implement rate limiting handling
- Add telemetry and logging

### Phase 4: Developer Experience
- Create interactive tool explorer
- Add example prompts library
- Implement tool usage analytics
- Create migration guides
- Add performance optimizations
- Implement streaming responses

### Phase 5: Production Readiness
- Security audit and hardening
- Performance profiling and optimization
- Comprehensive documentation
- CI/CD pipeline setup
- Monitoring and alerting
- Release management process

## Logical Dependency Chain

1. **Foundation** (Must be built first)
   - Project setup and configuration
   - MCP SDK integration
   - Basic authentication

2. **API Integration** (Depends on Foundation)
   - OpenAPI parsing
   - Tool generation
   - Request handling

3. **Core Features** (Depends on API Integration)
   - Individual API tools
   - Error handling
   - Validation

4. **Enhanced Features** (Depends on Core Features)
   - Workflow tools
   - Caching
   - Batching

5. **Production Features** (Depends on Enhanced Features)
   - Monitoring
   - Performance optimization
   - Documentation

## Risks and Mitigations

### Technical Challenges
- **Risk**: OpenAPI spec changes breaking tool generation
- **Mitigation**: Version lock specs, implement compatibility layer

### API Limitations
- **Risk**: Rate limiting affecting user experience
- **Mitigation**: Implement intelligent retry and caching strategies

### Security Concerns
- **Risk**: API key exposure in logs or errors
- **Mitigation**: Sanitize all outputs, use secure key storage

### Performance Issues
- **Risk**: Large API responses causing timeouts
- **Mitigation**: Implement streaming, pagination, and response filtering

## Appendix

### Technical Specifications
- **Language**: TypeScript 5.8+
- **Runtime**: Node.js 18+ (MCP SDK minimum requirement)
- **Key Dependencies**:
  - @modelcontextprotocol/sdk (latest)
  - zod (validation with JSON Schema generation)
  - node-fetch or native fetch
  
### MCP SDK Implementation Details
Based on SDK documentation:
- **Server Creation**: Use `McpServer` class with name/version config
- **Tool Registration**: `server.registerTool()` with Zod schema for input validation
- **Transport**: StdioServerTransport for CLI integration
- **Response Format**: `CallToolResult` with content array containing text/image types
- **Error Handling**: Try-catch with ZodError detection for validation failures
  
### Validation Strategy
- Use Zod schemas for all API request/response validation
- Leverage Zod's `.describe()` method for documenting fields
- Generate JSON Schema from Zod schemas using `zodToJsonSchema` for MCP tool definitions
- Ensure type safety between TypeScript types and runtime validation
  
### API Documentation References
- schemas/jigx-rest-api-v1-us-east-1-prod-default-oas30-postman.json
- schemas/rest-data-api-20-us-east-1-prod-default-oas30-postman.json
- schemas/rest-tool-api-20-us-east-1-prod-default-oas30-postman.json

### Development Guidelines
- Follow existing project conventions (no semicolons, kebab-case files)
- Implement comprehensive error handling
- Write tests for all tools
- Document all public APIs
- Use TypeScript strict mode

### OpenAPI Parsing Strategy
Based on analysis of Jigx API specs:
- **Format**: OpenAPI 3.0.1 specification
- **Structure**: Paths → Operations → Parameters/RequestBody/Responses
- **Authentication**: Security scheme "token-v1" (Bearer token)
- **Schema References**: Use `$ref` to components/schemas
- **Tool Naming**: Convert operationId to snake_case (e.g., ListOrganizations → list_organizations)
- **Parameter Handling**: Query params, path params, and request bodies mapped to Zod schemas

### Tool Implementation Pattern
Each MCP tool should follow this consistent structure:

```typescript
import { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// 1. Define Zod schema for input validation
const InputSchema = z.object({
  // Define fields with descriptions
  field: z.string().describe('Description of field')
})

// 2. Export tool definition
export const toolNameTool: Tool = {
  name: 'tool_name',
  description: 'Clear description of what the tool does',
  annotations: {
    title: 'Human-Friendly Title',
    destructiveHint: false,  // true if modifies/deletes data
    idempotentHint: true     // true if safe to retry
  },
  inputSchema: z.toJSONSchema(InputSchema) as Tool['inputSchema']
}

// 3. Export handler function
export async function handleToolName(
  args: any,
  // Include any required services/DALs as parameters
): Promise<CallToolResult> {
  try {
    // Validate input with Zod
    const validatedArgs = InputSchema.parse(args)
    
    // Perform operation
    const result = await performOperation(validatedArgs)
    
    // Return success
    return {
      content: [{
        type: 'text',
        text: `Success message with details: ${result.detail}`
      }]
    }
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return {
        content: [{
          type: 'text',
          text: `Validation error: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        }]
      }
    }
    
    // Handle other errors
    return {
      content: [{
        type: 'text',
        text: `Failed to perform operation: ${error instanceof Error ? error.message : String(error)}`
      }]
    }
  }
}
```

Key principles:
- Separate tool definition from handler logic
- Use Zod for input validation and JSON schema generation
- Consistent error handling with clear messages
- Type-safe throughout with TypeScript
- Clear separation of concerns

# TASKS:
☐ Research MCP SDK documentation and patterns 
☐ Analyze OpenAPI specs for Jigx APIs
☐ Set up project structure with MCP SDK
☐ Create base server configuration
☐ Create authentication handling
☐ Implement OpenAPI parser for tool generation
☐ Generate tools from jigx-rest-api-v1
☐ Generate tools from data-api-20
☐ Generate tools from tool-api-20
☐ Add comprehensive error handling
☐ Create test suite
☐ Test all generated tools