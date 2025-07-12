import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express, { type NextFunction, type Request, type Response } from 'express'
import { randomUUID } from 'node:crypto'
import type { Logger } from 'pino'
import pinoHttp from 'pino-http'
import pkg from '../package.json' with { type: 'json' }
import logger from './logger.js'
import { createJigxMcpServer } from './server/index.js'

interface RequestWithLog extends Request {
  readonly log: Logger
}

export { createJigxMcpServer } from './server/index.js'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const useHttp = args.includes('--http')
  const port = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000', 10)

  if (useHttp) {
    // Use shared logger instance
    logger.info('Starting Streamable HTTP server', { port })

    const app = express()

    // Track session metadata for expiry
    interface SessionMeta {
      readonly transport: StreamableHTTPServerTransport
      lastAccessed: number
    }

    const transports = new Map<string, SessionMeta>()
    const SESSION_TIMEOUT_MS = 1000 * 60 * 60 // 1 hour

    // Simple in-memory rate limiting middleware
    const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
    const RATE_LIMIT_MAX = 100 // max requests per window per IP
    const rateLimitMap = new Map<string, { count: number, windowStart: number }>()
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Only rate limit API endpoints
      if (!['/mcp'].includes(req.path) || req.method === 'OPTIONS' || req.path === '/health') return next()
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || (req.connection && (req.connection as unknown as {
        remoteAddress?: string
      }).remoteAddress) || 'unknown'
      let entry = rateLimitMap.get(ip)
      const now = Date.now()
      if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        entry = { count: 1, windowStart: now }
        rateLimitMap.set(ip, entry)
      } else {
        entry.count++
        if (entry.count > RATE_LIMIT_MAX) {
          res.status(429).json({
            jsonrpc: '2.0',
            error: {
              code: -32002,
              message: 'Rate limit exceeded. Try again later.'
            },
            id: (req as Request)?.body?.id
          })
          return
        }
      }
      next()
    })

    // Authentication middleware: block if JIGX_API_KEY is missing or empty
    app.use((req: Request, res: Response, next: NextFunction) => {
      const apiKey = process.env['JIGX_API_KEY']
      if (!apiKey || apiKey.trim() === '') {
        if (req.path === '/health') return next()
        if (!res.headersSent) {
          res.status(401).json({
            jsonrpc: '2.0',
            error: {
              code: -32001,
              message: 'Unauthorized: JIGX_API_KEY missing or invalid'
            },
            id: (req as Request)?.body?.id
          })
        }
        return
      }
      next()
    })

    // Add CORS support for browser clients
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, last-event-id')
      if (req.method === 'OPTIONS') {
        res.sendStatus(204)
      } else {
        next()
      }
    })

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
        let transport: StreamableHTTPServerTransport | undefined
        let isNewSession = false
        if (sessionId && transports.has(sessionId)) {
          // Reuse existing transport
          const meta = transports.get(sessionId)
          if (!meta) throw new Error('Session not found')
          transport = meta.transport
          meta.lastAccessed = Date.now()
          req.log.debug('Reusing existing transport', { sessionId })
        } else if (!sessionId || (sessionId && !transports.has(sessionId))) {
          // New initialization request (even if sessionId provided but not found)
          req.log.info('Initializing new MCP session', { sessionId })
          const server = createJigxMcpServer()
          const eventStore = new InMemoryEventStore()
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId || randomUUID(),
            eventStore,
            onsessioninitialized: (newSessionId: string) => {
              logger.info('Session initialized', {
                sessionId: newSessionId,
                totalSessions: transports.size + 1
              })
              if (!transport) {
                throw new Error('Transport must be defined for session')
              }
              transports.set(newSessionId, {
                transport,
                lastAccessed: Date.now()
              })
            }
          })
          // Set up onclose handler to clean up transport when closed
          server.onclose = async () => {
            const sid = transport ? transport.sessionId : undefined
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
          isNewSession = true
        }
        if (!transport) {
          req.log.error('Transport not initialized', { sessionId })
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error: transport not initialized'
            },
            id: req?.body?.id
          })
          return
        }
        await transport.handleRequest(req, res)
        req.log.debug(isNewSession ? 'New session request handled' : 'Existing session request handled', { sessionId })
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
      // Update lastAccessed for session
      const meta = transports.get(sessionId)
      if (!meta) throw new Error('Session not found')
      meta.lastAccessed = Date.now()
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
      await meta.transport.handleRequest(req, res)
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
        const meta = transports.get(sessionId)
        if (!meta) throw new Error('Session not found')
        await meta.transport.handleRequest(req, res)
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
    // Read version from package.json
    // pkg is imported at the top
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        name: 'jigx-mcp',
        version: pkg.version,
        transport: 'http',
        activeSessions: transports.size
      })
    })
    // Periodic session expiry cleanup
    setInterval(() => {
      const now = Date.now()
      for (const [sessionId, meta] of transports) {
        if (now - meta.lastAccessed > SESSION_TIMEOUT_MS) {
          logger.info('Session expired, cleaning up', { sessionId })
          meta.transport.close()
          transports.delete(sessionId)
        }
      }
    }, 1000 * 60 * 10) // every 10 minutes

    // Start the server
    app.listen(port, '127.0.0.1', () => {
      logger.info('MCP HTTP server started', {
        port,
        endpoint: `http://127.0.0.1:${port}/mcp`,
        healthCheck: `http://127.0.0.1:${port}/health`
      })
    })

    // Handle server shutdown (SIGINT and SIGTERM)
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Shutting down server (${signal})`)
      for (const [sessionId, meta] of transports) {
        try {
          logger.debug('Closing transport', { sessionId })
          await meta.transport.close()
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
    }
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    // Placeholder: session expiry logic could be added here (e.g., setInterval to clean up old sessions)
  } else {
    // Default stdio transport
    // Use shared logger instance
    const server = createJigxMcpServer()
    const transport = new StdioServerTransport()
    await server.connect(transport)
    logger.info('MCP server running on stdio transport')
  }
}

main().catch(error => {
  logger.fatal('Failed to start MCP server', {
    error: {
      message: error.message,
      stack: error.stack
    }
  })
  process.exit(1)
})
