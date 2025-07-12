import pino from 'pino'

const isDevelopment = process.env['NODE_ENV'] !== 'production'
const logLevel = process.env['LOG_LEVEL'] || (isDevelopment ? 'debug' : 'info')

const logger = pino({
  name: 'mcp-server',
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
      sync: true
    }
  }
})
export default logger
