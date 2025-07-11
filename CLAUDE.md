## Communication
Telegraph imperative voice. Concise, clear, maintain fidelity.
Follow existing patterns. Never proactively create docs (*.md) unless explicitly requested.
**ALWAYS study existing architecture and patterns before implementing. Match existing conventions.**

## Code Style
- No semicolons in TypeScript
- Kebab-case filenames
- `readonly` properties in interfaces/classes  
- Empty line at EOF
- Explicit types when ambiguous
- Use yarn (not npm)
- Barrel files (index.ts) per domain, no re-exports
- camelCase for acronyms: `getRsi()` not `getRSI()`
- `Record<string, unknown>` over `any`
- `typeof var === 'undefined'` not `var === undefined`
- Functions declare return type
- `Array<complex>` and `simple[]`
- Compact objects: `{[` not `{\n[`
- Single quotes
- `Id` not `ID`, `RagSystem` not `RAGSystem`
- NEVER use `any`/`unknown` except type-guards
- NEVER use forced type coercions like `as unknown as Type`
- ALL imports at top of file - NO dynamic imports unless necessary

## Error Handling
- Custom error classes extending Error
- Error codes for API responses
- Log with context: `logger.error('Operation failed', { error, context })`
- Wrap external calls in try-catch
- Structured error responses

## Commands
```bash
# Build/Dev
yarn build # Build TypeScript
yarn tc    # Check types (typecheck alias)
yarn test  # Run tests
yarn lint  # ESLint fix
yarn cc    # Full check (typecheck + test + lint)
yarn up    # Update dependencies

# CDK
cdk synth  # Synthesize CloudFormation
cdk list   # List stacks

# Testing
node --import tsx --test path/to/file.test.ts  # Single test
```

## Testing
- Files: `__tests__/` or `*.test.ts`
- Describe blocks, "should X when Y" naming
- AAA pattern: Arrange, Act, Assert
- Mock external services, use `__fixtures__/`

## Tech Stack
- Runtime: Node.js 20+ ES modules
- Infrastructure: AWS CDK v2
- Database: DynamoDB
- Auth: Cognito
- API: API Gateway REST

## Repository Structure
<!--keep this structure up to date-->
```
/
├── src/              # Source code
│   ├── auth/         # Authentication logic
│   ├── openapi/      # OpenAPI parsing & tool generation
│   ├── server/       # MCP server implementation
│   ├── tools/        # Generated API tools
│   │   ├── data-20/  # Data API tools
│   │   └── strata-20/ # Strata API tools
│   ├── types/        # TypeScript type definitions
│   └── utils/        # Utility functions
├── schemas/          # OpenAPI schema files
├── dist/             # Build output
└── *.config.js       # Config files
```

## Git Workflow
- Branches: `feat/`, `fix/`, `chore/` + description
- Commits: `type: concise description` (feat|fix|docs|style|refactor|test|chore)
- PR title = commit format

## Development Workflow
1. `yarn tc` after changes
2. Run individual tests for speed
3. `yarn cc` before commit

## Task Master AI - MCP Integration
```bash
# Core commands
mcp__taskmaster-ai__next_task                    # Find next task
mcp__taskmaster-ai__get_task --id=<id>          # Get task details
mcp__taskmaster-ai__update_subtask --id=<id> --prompt="..."  # Log progress
mcp__taskmaster-ai__set_task_status --id=<id> --status=done  # Complete task

# Complex operations
mcp__taskmaster-ai__parse_prd --input=prd-feature.txt --append
mcp__taskmaster-ai__expand_task --id=X --research --force
```

### Workflow
1. Get task → Understand requirements
2. Update subtask with plan
3. Set status to in-progress
4. Implement and update progress
5. Set status to done

## File Management
Create files when: New components, modules, or tests needed
Edit files when: Updating existing functionality
NEVER create unless necessary. ALWAYS prefer editing existing files.

---
# Important Reminders
Do what's asked; nothing more, nothing less.
NEVER create files unless necessary.
ALWAYS prefer editing existing files.
NEVER proactively create docs (*.md) unless explicitly requested.
