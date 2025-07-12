# Jigx MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with direct access to Jigx's low-code mobile app development platform APIs.

## Features

- **153 auto-generated tools** from OpenAPI specifications
- Full integration with Jigx REST APIs (v1, data-api-20, tool-api-20)
- Automatic Zod validation for all inputs
- Secure API key management
- Built-in error handling and retries

## Installation

```bash
# Clone the repository
git clone https://github.com/jigx-com/jigx-mcp.git
cd jigx-mcp

# Install dependencies
yarn install

# Build the project
yarn build
```

## Configuration

Set your Jigx API key as an environment variable:

```bash
export JIGX_API_KEY=your-api-key-here
```

## Usage

### Transport Modes

The server supports both stdio and HTTP transports:

#### Stdio Transport (Default)
```bash
# Start the MCP server on stdio
yarn start

# Development mode with auto-reload
yarn dev
```

#### HTTP Transport
```bash
# Start the HTTP server on port 3000
yarn start:http

# Development mode with HTTP transport
yarn dev:http

# Custom port
yarn build && node dist/src/index.js --http --port=8080
```

#### Health Check
When running in HTTP mode, you can check server status:
```bash
curl http://127.0.0.1:3000/health
```

#### Logging
The server uses structured logging with [pino](https://github.com/pinojs/pino) and [pino-http](https://github.com/pinojs/pino-http):

```bash
# Set log level (error, warn, info, debug, trace)
LOG_LEVEL=debug yarn start:http

# In development, logs are pretty-printed to stderr
# In production, logs are JSON formatted for parsing
NODE_ENV=production yarn start:http
```

Log features:
- **Request tracking**: Each HTTP request gets a unique ID with automatic timing
- **Session monitoring**: Track MCP session lifecycle and management
- **Performance metrics**: Automatic request duration and status codes
- **Error context**: Detailed error information with stack traces
- **Structured data**: All logs include relevant context fields (sessionId, requestId, etc.)
- **Best practices**: Uses official pino-http middleware for Express integration

### Development

```bash
# Run in development mode with auto-reload
yarn dev

# Run tests
yarn test

# Type check
yarn tc

# Lint
yarn lint

# Run all checks
yarn cc
```

## Available Tools

The server automatically generates tools from three Jigx API specifications:

- **Jigx REST API v1**: Core platform operations (organizations, solutions, members, databases)
- **Data API v20**: Database and data management operations
- **Tool API v20**: Development tools and utilities

Each tool includes:
- Automatic input validation using Zod schemas
- Proper authentication header attachment
- Comprehensive error handling
- Type-safe request/response handling

## Project Structure

```
src/
├── auth/          # Authentication management
├── openapi/       # OpenAPI parser and tool generator
├── server/        # MCP server implementation
├── tools/         # Tool implementations
├── types/         # TypeScript type definitions
└── index.ts       # Entry point

schemas/           # OpenAPI specifications
```

## Development

This project follows strict TypeScript conventions:
- No semicolons
- Kebab-case filenames
- Readonly properties in interfaces
- Comprehensive error handling
- Full test coverage

## License

MIT