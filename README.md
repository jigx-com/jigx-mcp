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

### As an MCP Server

```bash
# Start the MCP server
yarn start
```

The server runs on stdio and can be integrated with any MCP-compatible AI assistant.

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