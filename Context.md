# Project Context: Postiz

## Project Overview

- **Version**: ContextKit 0.2.0
- **Setup Date**: 2026-01-07
- **Components**: 6 components discovered and analyzed
- **Workspace**: None (standalone project)
- **Primary Tech Stack**: TypeScript, Next.js, NestJS, Prisma, React
- **Development Guidelines**: JavaScript/TypeScript (no ContextKit guidelines available yet)

## Component Architecture

**Project Structure**:
```
📁 postiz-app (Monorepo)
├── 🖥️ frontend (Next.js) - React-based web application - Next.js, React, TypeScript - ./apps/frontend
├── 🖥️ backend (NestJS) - REST API and server logic - NestJS, TypeScript - ./apps/backend
├── 🖥️ workers (NestJS) - Background job processing - NestJS, BullMQ - ./apps/workers
├── 🖥️ cron (NestJS) - Scheduled task execution - NestJS - ./apps/cron
├── 📦 extension (Browser Extension) - Chrome/Firefox browser extension - Vite, React - ./apps/extension
└── 📦 sdk (Node Package) - Public NPM SDK for API integration - Node.js, TypeScript - ./apps/sdk
```

**Component Summary**:
- **6 TypeScript components** - Next.js 15, NestJS 10, React 18
- **Dependencies**: 100+ unique dependencies across components (Prisma, Redis, BullMQ, Sentry, Stripe, etc.)
- **Monorepo**: PNPM workspace with NX build system

---

## Component Details

### Frontend - Next.js Web Application

**Location**: `./apps/frontend`
**Purpose**: Main web application for social media scheduling and management
**Tech Stack**: TypeScript, Next.js, React, Tailwind CSS, Mantine UI

**File Structure**:
```
apps/frontend/
├── src/
│   ├── app/          # Next.js app router pages
│   ├── components/   # React components (29 directories)
│   ├── lib/          # Utility libraries
│   └── middleware.ts # Next.js middleware
├── public/           # Static assets
├── next.config.js    # Next.js configuration
├── tailwind.config.js # Tailwind CSS configuration
└── postcss.config.mjs # PostCSS configuration
```

**Dependencies** (from package.json):
- `@nestjs/common`, `@nestjs/core` - Backend framework
- `@mantine/core` - UI component library
- `@tiptap/*` - Rich text editor
- `@sentry/nextjs` - Error tracking
- `@stripe/*` - Payment processing
- `next` - React framework
- `react`, `react-dom` - UI library
- `tailwindcss` - CSS framework

**Development Commands**:
```bash
# Development
pnpm run dev:frontend        # Start dev server on port 4200

# Build
pnpm run build:frontend      # Build for production

# Production
pnpm run start:prod:frontend # Start production server
```

**Code Style** (detected):
- Tailwind CSS for styling
- Mantine UI components
- No explicit formatter configuration found

---

### Backend - REST API Server

**Location**: `./apps/backend`
**Purpose**: RESTful API server handling authentication, data management, and business logic
**Tech Stack**: TypeScript, NestJS, Prisma

**File Structure**:
```
apps/backend/
├── src/
│   ├── api/          # API route controllers
│   ├── app.module.ts # NestJS app module
│   ├── main.ts       # Application entry point
│   ├── public-api/   # Public API endpoints
│   └── services/     # Business logic services
└── package.json
```

**Dependencies** (from package.json):
- `@nestjs/common`, `@nestjs/core` - Backend framework
- `@nestjs/swagger` - API documentation
- `@prisma/client` - Database ORM
- `@sentry/nestjs` - Error tracking
- `@casl/ability` - Authorization

**Development Commands**:
```bash
# Development
pnpm run dev:backend        # Start dev server with watch mode

# Build
pnpm run build:backend      # Build for production

# Production
pnpm run start:prod:backend # Start production server
```

**Code Style** (detected):
- NestJS convention-based architecture
- Module-based organization
- No explicit formatter configuration found

---

### Workers - Background Job Processing

**Location**: `./apps/workers`
**Purpose**: Handles background jobs using BullMQ for async task processing
**Tech Stack**: TypeScript, NestJS, BullMQ

**Development Commands**:
```bash
# Development
pnpm run dev:workers        # Start dev server with watch mode

# Build
pnpm run build:workers      # Build for production

# Production
pnpm run start:prod:workers # Start production server

# PM2
pnpm run workers:pm2        # Start with PM2 process manager
```

---

### Cron - Scheduled Tasks

**Location**: `./apps/cron`
**Purpose**: Executes scheduled tasks using NestJS scheduler
**Tech Stack**: TypeScript, NestJS, `@nestjs/schedule`

**Development Commands**:
```bash
# Development
pnpm run dev:cron           # Start dev server with watch mode

# Build
pnpm run build:cron         # Build for production

# Production
pnpm run start:prod:cron    # Start production server

# PM2
pnpm run cron:pm2           # Start with PM2 process manager
```

---

### Extension - Browser Extension

**Location**: `./apps/extension`
**Purpose**: Chrome and Firefox browser extension for social media integration
**Tech Stack**: TypeScript, Vite, React

**Development Commands**:
```bash
# Development
pnpm run dev:extension       # Build in development mode with watch

# Build
pnpm run build:extension     # Build production bundle
pnpm run build:chrome       # Build for Chrome
pnpm run build:firefox      # Build for Firefox
```

---

### SDK - Public NPM Package

**Location**: `./apps/sdk`
**Purpose**: Public Node.js SDK (@postiz/node) for API integration
**Tech Stack**: TypeScript, Node.js

**File Structure**:
```
apps/sdk/
├── src/          # Source files
├── dist/         # Compiled output
└── package.json
```

**Dependencies** (from package.json):
- `node-fetch` - HTTP client

**Development Commands**:
```bash
# Build and Publish
pnpm run publish-sdk        # Build and publish to NPM
```

---

## Libraries

**Location**: `./libraries`

### nestjs-libraries
**Purpose**: Shared NestJS modules and utilities
- Database (Prisma schema and migrations)

### react-shared-libraries
**Purpose**: Shared React components and utilities

---

## Development Environment

**Requirements** (from package.json):
- Node.js: >=22.12.0 <23.0.0
- PNPM: 10.6.1
- PostgreSQL (for Prisma)
- Redis (for BullMQ)

**Build Tools**:
- PNPM workspace manager
- NX (monorepo orchestration)
- Next.js build system
- NestJS CLI
- Vite (for extension)

**Formatters** (configured):
- No explicit formatter configurations found at project root
- Tailwind CSS for frontend styling

**Database**:
- Prisma ORM with PostgreSQL
- Schema location: `./libraries/nestjs-libraries/src/database/prisma/schema.prisma`

**Database Commands**:
```bash
pnpm run prisma-generate   # Generate Prisma client
pnpm run prisma-db-push    # Push schema to database
pnpm run prisma-db-pull    # Pull schema from database
pnpm run prisma-reset      # Reset database
```

---

## Development Workflow

**Full Development Mode**:
```bash
# Start all services in parallel
pnpm run dev

# Start specific service
pnpm run dev:frontend
pnpm run dev:backend
pnpm run dev:workers
pnpm run dev:cron
```

**Build All**:
```bash
pnpm run build              # Build all components
pnpm run build:frontend     # Build frontend only
pnpm run build:backend      # Build backend only
pnpm run build:workers      # Build workers only
pnpm run build:cron         # Build cron only
pnpm run build:extension    # Build extension only
```

**Testing**:
```bash
pnpm run test               # Run Jest tests with coverage
```

**Docker**:
```bash
pnpm run dev:docker         # Start development Docker environment
./var/docker/docker-build.sh  # Build Docker images
./var/docker/docker-create.sh  # Create Docker containers
```

**PM2 Production**:
```bash
pnpm run pm2                # Start all services with PM2
```

---

## Development Guidelines

**Applied Guidelines**: None (JavaScript/TypeScript guidelines not yet available in ContextKit)

**Guidelines Integration**:
- When JavaScript/TypeScript guidelines are added to ContextKit, they will be automatically loaded
- For now, follow existing code patterns in the codebase
- Adhere to Next.js and NestJS best practices

---

## Constitutional Principles

**Core Principles**:
- ✅ Accessibility-first design (UI supports all assistive technologies)
- ✅ Privacy by design (minimal data collection, explicit consent)
- ✅ Localizability from day one (externalized strings, cultural adaptation)
- ✅ Code maintainability (readable, testable, documented code)
- ✅ Platform-appropriate UX (native conventions, platform guidelines)

**Workspace Inheritance**: None - using global defaults

---

## ContextKit Workflow

**Systematic Feature Development**:
- `/ctxk:plan:1-spec` - Create business requirements specification (prompts interactively)
- `/ctxk:plan:2-research-tech` - Define technical research, architecture and implementation approach
- `/ctxk:plan:3-steps` - Break down into executable implementation tasks

**Development Execution**:
- `/ctxk:impl:start-working` - Continue development within feature branch (requires completed planning phases)
- `/ctxk:impl:commit-changes` - Auto-format code and commit with intelligent messages

**Quality Assurance**: Automated agents validate code quality during development
**Project Management**: All validated build/test commands documented above for immediate use

---

## Development Automation

**Quality Agents Available**:
- `build-project` - Execute builds with constitutional compliance validation
- `check-accessibility` - VoiceOver, contrast, keyboard navigation validation
- `check-localization` - String Catalog and cultural adaptation validation
- `check-error-handling` - Error handling patterns validation
- `check-modern-code` - API modernization and best practices
- `check-code-debt` - Technical debt cleanup and AI artifact removal

---

## Configuration Hierarchy

**Inheritance**: None → **This Project**

**This Project Inherits From**:
- **Workspace**: None (standalone project)
- **Project**: Component-specific configurations documented above

**Override Precedence**: Project component settings override workspace settings

---

*Generated by ContextKit with comprehensive component analysis. Manual edits preserved during updates.*
