import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js'
import { initializeAuth } from '../auth/index.js'
import logger from '../logger.js'
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
    // eslint-disable-next-line no-unused-vars
    handler: (_args: unknown) => Promise<CallToolResult>
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
      },
      instructions: 'A Model Context Protocol server providing access to Jigx low-code mobile app development platform APIs. Use these tools to manage organizations, solutions, databases, users, and app content through the Jigx platform.'
    }
  )

  // Register explicit tools first
  registerExplicitTools()

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
    handler: args => handleListOrganizations(args, { logger })
  }

  toolRegistry[getOrganizationTool.name] = {
    tool: getOrganizationTool,
    handler: args => handleGetOrganization(args, { logger })
  }

  // Register solution tools
  toolRegistry[listSolutionsTool.name] = {
    tool: listSolutionsTool,
    handler: args => handleListSolutions(args, { logger })
  }

  toolRegistry[getSolutionTool.name] = {
    tool: getSolutionTool,
    handler: args => handleGetSolution(args, { logger })
  }

  // Register organization member tools
  toolRegistry[listOrganizationMembersTool.name] = {
    tool: listOrganizationMembersTool,
    handler: args => handleListOrganizationMembers(args, { logger })
  }

  toolRegistry[getOrganizationMemberTool.name] = {
    tool: getOrganizationMemberTool,
    handler: args => handleGetOrganizationMember(args, { logger })
  }

  // Register solution member tools
  toolRegistry[listSolutionMembersTool.name] = {
    tool: listSolutionMembersTool,
    handler: args => handleListSolutionMembers(args, { logger })
  }

  toolRegistry[getSolutionMemberTool.name] = {
    tool: getSolutionMemberTool,
    handler: args => handleGetSolutionMember(args, { logger })
  }

  // Register solution content tool
  toolRegistry[setSolutionContentTool.name] = {
    tool: setSolutionContentTool,
    handler: args => handleSetSolutionContent(args, { logger })
  }

  // Register additional solution tools
  toolRegistry[getSolutionContentTool.name] = {
    tool: getSolutionContentTool,
    handler: args => handleGetSolutionContent(args, { logger })
  }

  toolRegistry[getSolutionSettingsTool.name] = {
    tool: getSolutionSettingsTool,
    handler: args => handleGetSolutionSettings(args, { logger })
  }

  // Register organization settings tool
  toolRegistry[getOrganizationSettingsTool.name] = {
    tool: getOrganizationSettingsTool,
    handler: args => handleGetOrganizationSettings(args, { logger })
  }

  // Register user tools
  toolRegistry[getUserTool.name] = {
    tool: getUserTool,
    handler: args => handleGetUser(args, { logger })
  }

  toolRegistry[listUsersTool.name] = {
    tool: listUsersTool,
    handler: args => handleListUsers(args, { logger })
  }

  toolRegistry[getMeTool.name] = {
    tool: getMeTool,
    handler: args => handleGetMe(args, { logger })
  }

  toolRegistry[getUserSettingsTool.name] = {
    tool: getUserSettingsTool,
    handler: args => handleGetUserSettings(args, { logger })
  }

  // Register additional solution tools
  toolRegistry[getSolutionJaclTool.name] = {
    tool: getSolutionJaclTool,
    handler: args => handleGetSolutionJacl(args, { logger })
  }

  // Register data tools
  toolRegistry[getDatabaseTool.name] = {
    tool: getDatabaseTool,
    handler: args => handleGetDatabase(args, { logger })
  }

  toolRegistry[listDataRowsTool.name] = {
    tool: listDataRowsTool,
    handler: args => handleListDataRows(args, { logger })
  }

  toolRegistry[getDataRowTool.name] = {
    tool: getDataRowTool,
    handler: args => handleGetDataRow(args, { logger })
  }

  // Register additional solution tools
  toolRegistry[getSolutionCustomTool.name] = {
    tool: getSolutionCustomTool,
    handler: args => handleGetSolutionCustom(args, { logger })
  }

  toolRegistry[getSolutionCopyPolicyTool.name] = {
    tool: getSolutionCopyPolicyTool,
    handler: args => handleGetSolutionCopyPolicy(args, { logger })
  }

  console.error(`Registered ${Object.keys(toolRegistry).length} explicit tools`)
}
