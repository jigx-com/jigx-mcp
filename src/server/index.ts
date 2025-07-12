import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js'
import { initializeAuth } from '../auth/index.js'
import { getDatabaseTool, getDataRowTool, handleGetDatabase, handleGetDataRow, handleListDataRows, listDataRowsTool } from '../tools/data-20/data/index.js'
import {
  getOrganizationMemberTool,
  getOrganizationSettingsTool,
  getOrganizationTool,
  handleGetOrganization,
  handleGetOrganizationMember,
  handleGetOrganizationSettings,
  handleListOrganizationMembers,
  handleListOrganizations,
  listOrganizationMembersTool,
  listOrganizationsTool
} from '../tools/strata-20/organizations/index.js'
import {
  getSolutionContentTool,
  getSolutionCopyPolicyTool,
  getSolutionCustomTool,
  getSolutionJaclTool,
  getSolutionMemberTool,
  getSolutionSettingsTool,
  getSolutionTool,
  handleGetSolution,
  handleGetSolutionContent,
  handleGetSolutionCopyPolicy,
  handleGetSolutionCustom,
  handleGetSolutionJacl,
  handleGetSolutionMember,
  handleGetSolutionSettings,
  handleListSolutionMembers,
  handleListSolutions,
  handleSetSolutionContent,
  listSolutionMembersTool,
  listSolutionsTool,
  setSolutionContentTool
} from '../tools/strata-20/solutions/index.js'
import {
  getMeTool,
  getUserSettingsTool,
  getUserTool,
  handleGetMe,
  handleGetUser,
  handleGetUserSettings,
  handleListUsers,
  listUsersTool
} from '../tools/strata-20/users/index.js'

// Tool registry
export interface ToolRegistry {
  [toolName: string]: {
    tool: Tool
    handler: (args: unknown) => Promise<CallToolResult>
  }
}

const toolRegistry: ToolRegistry = {}

export function createJigxMcpServer(): Server {
  // Initialize auth
  initializeAuth()

  const server = new Server(
    {
      name: 'jigx-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  )

  // Register explicit tools first
  registerExplicitTools()

  // Load and register additional tools from OpenAPI specs
  // TODO: Fix path resolution for schemas in compiled output
  // loadToolsFromSpecs()

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = Object.values(toolRegistry).map(({ tool }) => tool)
    return { tools }
  })

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params

    const toolEntry = toolRegistry[name]
    if (!toolEntry) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      )
    }

    try {
      // Execute handler (validation is done inside the handler)
      return await toolEntry.handler(args)
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : String(error)
      )
    }
  })

  return server
}

function registerExplicitTools(): void {
  // Register organization tools
  toolRegistry[listOrganizationsTool.name] = {
    tool: listOrganizationsTool,
    handler: handleListOrganizations
  }

  toolRegistry[getOrganizationTool.name] = {
    tool: getOrganizationTool,
    handler: handleGetOrganization
  }

  // Register solution tools
  toolRegistry[listSolutionsTool.name] = {
    tool: listSolutionsTool,
    handler: handleListSolutions
  }

  toolRegistry[getSolutionTool.name] = {
    tool: getSolutionTool,
    handler: handleGetSolution
  }

  // Register organization member tools
  toolRegistry[listOrganizationMembersTool.name] = {
    tool: listOrganizationMembersTool,
    handler: handleListOrganizationMembers
  }

  toolRegistry[getOrganizationMemberTool.name] = {
    tool: getOrganizationMemberTool,
    handler: handleGetOrganizationMember
  }

  // Register solution member tools
  toolRegistry[listSolutionMembersTool.name] = {
    tool: listSolutionMembersTool,
    handler: handleListSolutionMembers
  }

  toolRegistry[getSolutionMemberTool.name] = {
    tool: getSolutionMemberTool,
    handler: handleGetSolutionMember
  }

  // Register solution content tool
  toolRegistry[setSolutionContentTool.name] = {
    tool: setSolutionContentTool,
    handler: handleSetSolutionContent
  }

  // Register additional solution tools
  toolRegistry[getSolutionContentTool.name] = {
    tool: getSolutionContentTool,
    handler: handleGetSolutionContent
  }

  toolRegistry[getSolutionSettingsTool.name] = {
    tool: getSolutionSettingsTool,
    handler: handleGetSolutionSettings
  }

  // Register organization settings tool
  toolRegistry[getOrganizationSettingsTool.name] = {
    tool: getOrganizationSettingsTool,
    handler: handleGetOrganizationSettings
  }

  // Register user tools
  toolRegistry[getUserTool.name] = {
    tool: getUserTool,
    handler: handleGetUser
  }

  toolRegistry[listUsersTool.name] = {
    tool: listUsersTool,
    handler: handleListUsers
  }

  toolRegistry[getMeTool.name] = {
    tool: getMeTool,
    handler: handleGetMe
  }

  toolRegistry[getUserSettingsTool.name] = {
    tool: getUserSettingsTool,
    handler: handleGetUserSettings
  }

  // Register additional solution tools
  toolRegistry[getSolutionJaclTool.name] = {
    tool: getSolutionJaclTool,
    handler: handleGetSolutionJacl
  }

  // Register data tools
  toolRegistry[getDatabaseTool.name] = {
    tool: getDatabaseTool,
    handler: handleGetDatabase
  }

  toolRegistry[listDataRowsTool.name] = {
    tool: listDataRowsTool,
    handler: handleListDataRows
  }

  toolRegistry[getDataRowTool.name] = {
    tool: getDataRowTool,
    handler: handleGetDataRow
  }

  // Register additional solution tools
  toolRegistry[getSolutionCustomTool.name] = {
    tool: getSolutionCustomTool,
    handler: handleGetSolutionCustom
  }

  toolRegistry[getSolutionCopyPolicyTool.name] = {
    tool: getSolutionCopyPolicyTool,
    handler: handleGetSolutionCopyPolicy
  }

  console.error(`Registered ${Object.keys(toolRegistry).length} explicit tools`)
}
