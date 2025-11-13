# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**ai-cli-syncer** is a Rust-based command-line tool that synchronizes core instructions and MCP (Model Context Protocol) server configurations across various coding agent CLI tools (Claude Code, Cursor, Windsurf, etc.). A local Web UI is planned for future implementation.

### Core Features
- Synchronize configuration files across AI coding agents (CLAUDE.md, .cursorrules, MCP settings, etc.)
- Modify agent settings through CLI commands
- Local Web UI for configuration management (planned)

### Technology Stack
- **Language**: Rust
- **CLI Framework**: clap (recommended)
- **Async Runtime**: tokio
- **Web Framework**: axum or actix-web (for future Web UI)

---

## Documentation

### 📋 [Development Guidelines](./docs/DEVELOPMENT_GUIDELINES.md)
Coding principles and best practices for this project:
- SOLID Principles (SRP, OCP, LSP, ISP, DIP)
- DRY, KISS, YAGNI principles
- TDD (Test-Driven Development)
- SDD + TDD Integration

### 🏗️ [Architecture](./docs/ARCHITECTURE.md)
System architecture, build commands, and technical details:
- Development environment setup
- Module structure and responsibilities
- Dependencies and configuration
- Error handling and security

### 📐 [Specifications](./docs/specs/README.md)
RFC and ADR documents for features and architectural decisions:
- RFC (Request for Comments) for new features
- ADR (Architecture Decision Records) for design decisions
- Integration with TDD workflow
- Templates and examples

### 🔄 [SDD + TDD Workflow](./docs/workflows/SDD_TDD_WORKFLOW.md)
Integrated development workflow combining specs and tests:
- Spec → Test → Code process
- Step-by-step implementation guide
- AI agent collaboration tips
- Practical examples

### 📝 [Documentation Style Guide](./docs/DOCUMENTATION_STYLE.md)
Standards for writing and maintaining project documentation:
- Document structure and organization
- Writing style and conventions
- Code examples and formatting
- Content guidelines

---

## Quick Start

```bash
# Build the project
cargo build

# Run tests
cargo test

# Run in development mode
cargo run -- [ARGS]
```

For detailed commands and setup instructions, see [ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## Project Philosophy

This project follows:
- **Test-Driven Development**: Write tests first, implement second
- **Simplicity First**: Keep it simple, add complexity only when needed
- **Clear Documentation**: All significant decisions and structures are documented
- **Rust Best Practices**: Safety, performance, and idiomatic Rust code

See [DEVELOPMENT_GUIDELINES.md](./docs/DEVELOPMENT_GUIDELINES.md) for complete development principles.
