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
- Avoid `any`/`unknown` except type-guards
- `Record<string, unknown>` over `any`
- `typeof var === 'undefined'` not `var === undefined`
- Functions declare return type
- `Array<complex>` and `simple[]`
- Compact objects: `{[` not `{\n[`
- Single quotes
- `Id` not `ID`, `RagSystem` not `RAGSystem`
- NEVER use forced type coercions like `as unknown as Type`
- NEVER use `any` type - use proper types or discriminated unions
- ALL imports go at the top of the file - NO dynamic imports unless absolutely necessary

## Error Handling
- Custom error classes extending Error
- Error codes for API responses
- Log with context: `logger.error('Operation failed', { error, context })`
- Wrap external calls in try-catch
- Lambda: Distinguish 4xx/5xx, structured responses `{ error: { code, message } }`
- Retry transient AWS errors, use correlation IDs, Powertools Logger

## Commands
```bash
# Build/Dev
yarn build         # Build TypeScript
yarn tc            # Check types (typecheck alias)
yarn test          # Run tests
yarn lint          # ESLint fix
yarn cc            # Full check (typecheck + test + lint)
yarn up            # Update dependencies

# CDK
cdk synth          # Synthesize CloudFormation
cdk list           # List stacks

# Testing
node --import tsx --test path/to/file.test.ts  # Single test
```

## Testing
- Files: `__tests__/` or `*.test.ts`
- Structure: Describe blocks, "should X when Y" naming
- AAA pattern: Arrange, Act, Assert
- Mock AWS services, use `__fixtures__/`

## Architecture
### AWS Multi-Region
- Primary: PROD: us-east-1, DEV: us-west-2 (cdk.json)
- Replicas: PROD: eu-central-1, ap-southeast-2, DEV: us-west-1
- Stamps: dev/test/prod branches
- Always develop in DEV stamp first
- NEVER deploy. User will do so.

### Stack Organization
1. Service Root Stack: Pipeline orchestrator
2. Stage 0-4: Sequential deployment
3. Step 5: Domain stacks (Core, Build, Data, Strata, System, Tool, Trust)
4. Lambda Functions: `/functions`, own package.json

### Lambda Pattern
- Powertools (logging/tracing), Middy middleware
- Repository pattern (DynamoDB/S3/Cognito)
- Hex architecture: `/functions/utils/hex`
- Handler: Export `handler` with Middy wrapper
- Flow: Parse/validate → business logic → format response
- Response: `{ statusCode, body: JSON.stringify(data) }`
- Errors: `{ statusCode, body: JSON.stringify({ error }) }`

### Tech Stack
- Runtime: Node.js 20+ ES modules
- Infrastructure: AWS CDK v2
- Database: DynamoDB
- Auth: Cognito
- API: API Gateway REST

## DynamoDB Patterns
- Single table design, GSIs for access patterns
- Prefixes: `USER#`, `ORG#`, `COMP#` (composites)
- Transactions for multi-item ops
- Validate entity existence before operations
- Optimistic locking: `_version` attributes
- Repository methods: `get`, `list`, `create`, `update`, `delete`
- Clone operations preserve relationships
- Use `@aws-sdk/lib-dynamodb` for automatic marshalling

## Security
- Least privilege IAM
- API Gateway authorizers on all endpoints
- Validate inputs (Middy), sanitize outputs
- KMS encryption at rest, Secrets Manager for keys
- CloudTrail audit logging

## Performance
- Minimize Lambda package size, use layers
- Connection pooling, cache frequent data
- Provisioned concurrency for critical functions
- Monitor cold starts with X-Ray

## Repository Structure
```
/
├── bin/              # CDK app entry
├── lib/              # CDK stacks
│   ├── cdk-shared/   # Shared constructs
│   ├── service-*/    # Service stages
│   └── step-5-*/     # Domain stacks
├── functions/        # Lambda code
│   ├── */index.ts    # Handlers
│   └── utils/hex/    # Hex architecture
├── athena/           # SQL queries (IGNORE)
├── provision/        # Data templates (IGNORE)
└── test/             # Integration tests (IGNORE)
```

## Git Workflow
- Branches: `feat/`, `fix/`, `chore/` + description
- Commits: `type: concise description` (feat|fix|docs|style|refactor|test|chore)
- PR title = commit format
- Rebase on stamp branch, squash commits

## Development Workflow
1. `yarn tc` after changes
2. Run individual tests for speed
3. `yarn cc` before commit
4. Use region-specific deploys
5. Check CDK diff: `cdk diff [stack]`

## Task Master AI - MCP Integration

### Quick Reference
```bash
mcp__taskmaster-ai__next_task                          # Find next task
mcp__taskmaster-ai__get_task --id=<id>                # Get task details
mcp__taskmaster-ai__update_subtask --id=<id> --prompt="..."  # Log progress
mcp__taskmaster-ai__set_task_status --id=<id> --status=done  # Complete task
```

### Workflow
1. `get_tasks` → `get_task --id=X` → Understand requirements
2. Explore codebase, plan approach
3. `update_subtask --id=X --prompt="plan: ..."` → Log plan
4. `set_task_status --id=X --status=in-progress` → Start
5. Implement code
6. `update_subtask --id=X --prompt="implemented: ..."` → Log results
7. `set_task_status --id=X --status=done` → Complete

### Complex Tasks
- PRD: Create `prd-feature.txt`, parse with `mcp__taskmaster-ai__parse_prd --input=prd-feature.txt --append`
- Analyze: `mcp__taskmaster-ai__analyze_project_complexity --from=X --to=Y`
- Expand: `mcp__taskmaster-ai__expand_task --id=X --research --force`
- Dependencies: `mcp__taskmaster-ai__add_dependency --id=X --depends-on=Y`

### Key Notes
- IDs: `1` (main), `1.1` (subtask), `1.1.1` (sub-subtask)
- Status: `pending`, `in-progress`, `done`, `blocked`
- DO NOT RE-INITIALIZE project
- Use `--research` for complex decisions
- Update subtasks immediately after progress

## File Management
Create files when: New Lambda, CDK construct, or test needed
Edit files when: Updating existing functionality, modules, or configs

---
# Important Reminders
Do what's asked; nothing more, nothing less.
NEVER create files unless necessary.
ALWAYS prefer editing existing files.
NEVER proactively create docs (*.md) unless explicitly requested.
