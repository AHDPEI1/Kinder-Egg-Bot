# Replit.md

## Overview

This is a **Mastra-based AI automation framework** for building agentic workflows triggered by time-based schedules (cron) or webhooks (Telegram, Slack, Linear, etc.). The project uses TypeScript with the Mastra framework for orchestrating AI agents, tools, and workflows, with Inngest providing durable execution and step-by-step orchestration.

The current implementation includes a Kinder Egg game bot for Telegram that uses an AI agent to interact with users through a collectible figurine game experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Framework
- **Mastra Framework**: The main orchestration layer for agents, tools, and workflows
- **Inngest**: Provides durable workflow execution with automatic retries, step memoization, and resume capabilities
- **TypeScript + ES Modules**: Modern TypeScript with ES2022 target and bundler module resolution

### Agent Architecture
- Agents are defined in `src/mastra/agents/` using the `Agent` class from `@mastra/core/agent`
- Agents use OpenAI or OpenRouter models via `@ai-sdk/openai` or `@openrouter/ai-sdk-provider`
- Memory persistence uses `@mastra/memory` with PostgreSQL (`@mastra/pg`) or LibSQL (`@mastra/libsql`) storage backends
- **Important**: Replit Playground UI requires `generateLegacy()` method for backward compatibility, not the newer `.generate()` methods

### Workflow Architecture
- Workflows defined in `src/mastra/workflows/` using `createWorkflow()` and `createStep()` from `@mastra/core/workflows`
- Steps chain with `.then()`, run in parallel with `.parallel()`, and support branching with `.branch()`
- Suspend/resume pattern for human-in-the-loop interactions
- Workflows must be registered in `src/mastra/index.ts`

### Trigger System
- **Time-based triggers**: Use `registerCronTrigger()` in `src/triggers/cronTriggers.ts` - called BEFORE Mastra initialization, not in apiRoutes
- **Webhook triggers**: Use `registerApiRoute()` pattern - spread into apiRoutes array in `src/mastra/index.ts`
- Trigger handlers receive `mastra` instance and `triggerInfo` with payload data
- See `src/triggers/telegramTriggers.ts` and `src/triggers/slackTriggers.ts` for webhook patterns

### Storage Layer
- Shared PostgreSQL storage via `sharedPostgresStorage` in `src/mastra/storage.ts`
- Used for workflow state persistence, memory, and thread management
- Drizzle ORM compatibility (may use LibSQL in development, PostgreSQL in production)

### Inngest Integration
- Custom Inngest client in `src/mastra/inngest/client.ts`
- `inngestServe` function bridges Mastra workflows with Inngest execution
- Real-time capabilities via `@inngest/realtime` middleware
- Dev server runs on port 3000, Mastra server on port 5000

### Logging
- Production logging uses Pino via custom `ProductionPinoLogger` class
- Mastra's built-in `PinoLogger` from `@mastra/loggers` also available

## External Dependencies

### AI/LLM Providers
- **OpenAI**: Primary model provider via `@ai-sdk/openai`
- **OpenRouter**: Alternative model routing via `@openrouter/ai-sdk-provider`
- **Vercel AI SDK**: Core AI functionality via `ai` package

### Messaging Platforms
- **Telegram**: Bot API integration via custom webhook handler
- **Slack**: Web API client via `@slack/web-api`

### Database/Storage
- **PostgreSQL**: Primary production storage via `@mastra/pg`
- **LibSQL**: Alternative/development storage via `@mastra/libsql`
- **pgvector**: Vector storage for semantic recall (PostgreSQL extension)

### Orchestration
- **Inngest**: Durable workflow execution, cron scheduling, event-driven triggers
- **Inngest CLI**: Local development server

### External APIs
- **Exa**: Search/research API via `exa-js`

### Development Tools
- **Mastra CLI**: Development server (`npm run dev` runs `mastra dev`)
- **TypeScript**: Strict mode, ES2022 target
- **Prettier**: Code formatting
- **tsx**: TypeScript execution for scripts