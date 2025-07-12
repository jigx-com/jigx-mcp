#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js'
import express, { type Request, type Response } from 'express'
import { randomUUID } from 'node:crypto'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { createJigxMcpServer } from './server/index.js'

// Extend Express Request type to include pino logger
interface RequestWithLog extends Request {
  log: pino.Logger
}

// Create logger with proper configuration
function createLogger(transport: 'stdio' | 'http'): pino.Logger {
  const isDevelopment = process.env['NODE_ENV'] !== 'production'
  const logLevel = process.env['LOG_LEVEL'] || (isDevelopment ? 'debug' : 'info')

  return pino({
    level: logLevel,
    transport: isDevelopment ? {
      target: 'pino-pretty',
      options: {
        destination: 2, // stderr
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    } : {
      target: 'pino/file',
      options: {
        destination: 2, // stderr
        sync: transport === 'stdio'
      }
    },
    base: {
      transport
    }
  })
}

export { createJigxMcpServer } from './server/index.js'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const useHttp = args.includes('--http')
  const port = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000', 10)

  if (useHttp) {
    const logger = createLogger('http')
    logger.info('Starting Streamable HTTP server', { port })

    const app = express()
    const transports = new Map<string, StreamableHTTPServerTransport>()

    // Use pino-http for proper Express integration
    app.use(pinoHttp({
      logger,
      // Generate custom request ID
      genReqId: () => randomUUID(),
      // Custom success message
      customSuccessMessage: (req, res, responseTime) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`
      },
      // Custom error message
      customErrorMessage: (req, res, error) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${error.message}`
      },
      // Customize which properties to log
      customProps: req => ({
        sessionId: req.headers['mcp-session-id'] as string | undefined
      })
    }))

    // Parse JSON bodies
    app.use(express.json())

    // Handle POST requests for JSON-RPC communication
    app.post('/mcp', async (req: RequestWithLog, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined

      req.log.debug('Processing MCP POST request', {
        ...(sessionId && { sessionId })
      })

      try {
        let transport: StreamableHTTPServerTransport

        if (sessionId && transports.has(sessionId)) {
          // Reuse existing transport
          transport = transports.get(sessionId)!
          req.log.debug('Reusing existing transport', { sessionId })
        } else if (!sessionId) {
          // New initialization request
          req.log.info('Initializing new MCP session')

          const server = createJigxMcpServer()
          const eventStore = new InMemoryEventStore()

          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            eventStore, // Enable resumability
            onsessioninitialized: (newSessionId: string) => {
              // Store the transport by session ID when session is initialized
              logger.info('Session initialized', {
                sessionId: newSessionId,
                totalSessions: transports.size + 1
              })
              transports.set(newSessionId, transport)
            }
          })

          // Set up onclose handler to clean up transport when closed
          server.onclose = async () => {
            const sid = transport.sessionId
            if (sid && transports.has(sid)) {
              logger.info('Transport closed, cleaning up', {
                sessionId: sid,
                remainingSessions: transports.size - 1
              })
              transports.delete(sid)
            }
          }

          // Connect the transport to the MCP server BEFORE handling the request
          await server.connect(transport)
          await transport.handleRequest(req, res)
          req.log.debug('New session request handled')
          return // Already handled
        } else {
          // Invalid request - no session ID or not initialization request
          req.log.error('Invalid request: missing or invalid session ID', {
            sessionId,
            hasSession: !!sessionId,
            sessionExists: sessionId ? transports.has(sessionId) : false
          })

          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided'
            },
            id: req?.body?.id
          })
          return
        }

        // Handle the request with existing transport
        await transport.handleRequest(req, res)
        req.log.debug('Existing session request handled', { sessionId })
      } catch (error) {
        req.log.error('Error handling MCP request', {
          sessionId,
          error: {
            message: (error as Error).message,
            stack: (error as Error).stack
          }
        })

        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error'
            },
            id: req?.body?.id
          })
        }
      }
    })

    // Handle GET requests for SSE streams
    app.get('/mcp', async (req: RequestWithLog, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined

      if (!sessionId || !transports.has(sessionId)) {
        req.log.error('Invalid GET request: missing or invalid session ID', {
          sessionId,
          hasSession: !!sessionId,
          sessionExists: sessionId ? transports.has(sessionId) : false
        })

        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided'
          },
          id: req?.body?.id
        })
        return
      }

      // Check for Last-Event-ID header for resumability
      const lastEventId = req.headers['last-event-id'] as string | undefined
      if (lastEventId) {
        req.log.info('Client reconnecting with Last-Event-ID', {
          sessionId,
          lastEventId
        })
      } else {
        req.log.info('Establishing new SSE stream', { sessionId })
      }

      const transport = transports.get(sessionId)!
      await transport.handleRequest(req, res)
    })

    // Handle DELETE requests for session termination
    app.delete('/mcp', async (req: RequestWithLog, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined

      if (!sessionId || !transports.has(sessionId)) {
        req.log.error('Invalid DELETE request: missing or invalid session ID', {
          sessionId,
          hasSession: !!sessionId,
          sessionExists: sessionId ? transports.has(sessionId) : false
        })

        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided'
          },
          id: req?.body?.id
        })
        return
      }

      req.log.info('Received session termination request', { sessionId })

      try {
        const transport = transports.get(sessionId)!
        await transport.handleRequest(req, res)
      } catch (error) {
        req.log.error('Error handling session termination', {
          sessionId,
          error: {
            message: (error as Error).message,
            stack: (error as Error).stack
          }
        })

        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Error handling session termination'
            },
            id: req?.body?.id
          })
        }
      }
    })

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        name: 'jigx-mcp',
        version: '1.0.0',
        transport: 'http',
        activeSessions: transports.size
      })
    })

    // Start the server
    app.listen(port, '127.0.0.1', () => {
      logger.info('MCP HTTP server started', {
        port,
        endpoint: `http://127.0.0.1:${port}/mcp`,
        healthCheck: `http://127.0.0.1:${port}/health`
      })
    })

    // Handle server shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down server')

      // Close all active transports to properly clean up resources
      for (const [sessionId, transport] of transports) {
        try {
          logger.debug('Closing transport', { sessionId })
          await transport.close()
          transports.delete(sessionId)
        } catch (error) {
          logger.error('Error closing transport', {
            sessionId,
            error: {
              message: (error as Error).message,
              stack: (error as Error).stack
            }
          })
        }
      }

      logger.info('Server shutdown complete')
      process.exit(0)
    })
  } else {
    // Default stdio transport
    const logger = createLogger('stdio')
    const server = createJigxMcpServer()
    const transport = new StdioServerTransport()
    await server.connect(transport)
    logger.info('MCP server running on stdio transport')
  }
}

main().catch(error => {
  const logger = pino({
    transport: {
      target: 'pino/file',
      options: {
        destination: 2,
        sync: true
      }
    }
  })
  logger.fatal('Failed to start MCP server', {
    error: {
      message: error.message,
      stack: error.stack
    }
  })
  process.exit(1)
})
