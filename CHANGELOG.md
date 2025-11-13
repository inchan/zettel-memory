# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

#### CLI Improvements
- **Root-level option support**: CLI now accepts options directly without `server` subcommand
  - ✅ **Recommended**: `node cli.js --vault ~/vault --index ~/.index.db`
  - ⚠️ **Backward compatible**: `node cli.js server --vault ~/vault` still works
  - 🎯 **Claude Desktop compatible**: Direct execution without subcommand
- **Option inheritance**: Subcommands now properly inherit parent options using `optsWithGlobals()`
- **Help output**: Updated `--help` to reflect new usage patterns

#### Security
- **Healthcheck**: Removed unnecessary file access operations for security
  - Now only validates paths without opening files
  - Reduces attack surface for vault inspection

### Technical Details
- Commander.js root-level `.action()` handler for direct execution
- `optsWithGlobals()` used in subcommands for proper option inheritance
- All CLI options (--vault, --index, --mode, --timeout, --retries, --verbose) available at root level

### Migration Guide
**Before (v0.1.0):**
```bash
# ❌ This fails in Claude Desktop
node cli.js server --vault ~/vault --index ~/.index.db
```

**After (v0.1.1+):**
```bash
# ✅ Works everywhere including Claude Desktop
node cli.js --vault ~/vault --index ~/.index.db

# ⚠️ Old way still works (backward compatible)
node cli.js server --vault ~/vault --index ~/.index.db
```

---

## [0.1.0] - 2025-11-13

### Added

#### New MCP Tools
- `update_note`: Update existing notes
  - Partial updates supported (only provide fields to change)
  - Auto-updates `updated` timestamp
  - Syncs with search index automatically
  - Validates at least one field is provided
- `delete_note`: Delete notes permanently
  - Requires explicit `confirm: true` parameter for safety
  - Returns note info before deletion
  - Removes from search index automatically
  - **Warning**: Cannot be undone

#### Search Implementation ✅
- `search_memory`: Full-text search powered by SQLite FTS5
  - FTS5 ranking algorithm with BM25 scoring
  - Category and tag filtering
  - Performance metrics (search time, result count)
  - Snippet generation with query context
  - Lazy initialization of IndexSearchEngine

#### Testing Infrastructure
- Basic test coverage: 24.1% (statements)
  - `common`: 75.57% coverage
  - `mcp-server/tools`: 40.93% coverage
  - `storage-md`: 29.77% coverage
- 25 passing unit tests across 4 test suites
- Integration test for complete CRUD workflows

### Changed
- Upgraded from alpha to stable v0.1.0 release
- Updated `findNoteByUid` API to return `MarkdownNote | null`
- Improved error messages with specific error codes
- Enhanced tool registry with all 6 CRUD operations

### Fixed
- TypeScript compilation with `exactOptionalPropertyTypes`
- Search engine instantiation with proper lazy loading
- Note deletion properly removes from FTS5 index
- Update operation syncs Front Matter timestamps correctly

### Technical Details
- **Complete MCP Tools**: 6 (create/read/list/search/update/delete)
- **Test Coverage**: 24.1% → Target 50% for v0.2.0
- **Search Engine**: SQLite FTS5 with unicode61 tokenizer
- **Build System**: All packages compile without errors
- **Linting**: ESLint + Prettier passing

### Removed
- Placeholder implementation of `search_memory` (replaced with real FTS5)
- `undefined` placeholders for `update_note` and `delete_note`

### Known Limitations
- Test coverage still below 50% target (currently 24%)
- `index-search` package has 0% test coverage (needs tests)
- File watcher not yet implemented (manual refresh required)
- Performance benchmarks not yet validated
- Olima context-aware ranking engine is TODO

### Migration from v0.1.0-alpha.0
No breaking changes. All existing tools remain compatible.
New tools (`update_note`, `delete_note`, fully-functional `search_memory`) are additive.

---

## [0.1.0-alpha.0] - 2025-01-12

### Added

#### MCP Server & CLI
- Initial MCP server implementation with JSON-RPC 2.0 over stdio
- CLI with `--vault` and `--index` options
- Healthcheck command for vault validation
- Version command

#### Core Tools (MVP)
- `create_note`: Create new Markdown notes with Front Matter
  - Auto-generated timestamp-based UIDs
  - PARA categorization (Projects/Areas/Resources/Archives)
  - Tag support
  - Project association
  - Zettelkasten-style linking
- `read_note`: Read notes by UID
  - Optional metadata (file size, word count, character count)
  - Optional link analysis (backlinks, broken links)
- `list_notes`: List and filter notes
  - Filter by category, tags, project
  - Sort by created/updated/title (asc/desc)
  - Pagination support (limit/offset)
- `search_memory`: Placeholder for FTS5 search (coming in v0.2.0)

#### Storage Layer
- Markdown + YAML Front Matter storage format
- Atomic file writes with temp → rename pattern
- File system based storage in vault directory
- UID-based note identification (ISO 8601 timestamp format)
- Automatic file naming: `{sanitized-title}-{uid}.md`

#### Note Features
- PARA organizational method support
- Zettelkasten UID linking
- Backlink detection
- Broken link detection
- Tag-based categorization
- Project association

#### Developer Experience
- TypeScript monorepo with npm workspaces
- 5 modular packages: mcp-server, storage-md, index-search, assoc-engine, common
- Comprehensive error handling with custom error types
- Zod schema validation for all tool inputs
- Development guidelines (SOLID, TDD/SDD)
- GitHub Actions CI/CD pipeline

#### Documentation
- Comprehensive README with quickstart guide
- Claude Desktop configuration example
- 3-month MVP roadmap
- Technical specification document
- Development guidelines
- Architecture documentation

### Technical Details
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.0+
- **Storage**: Local file system (Markdown)
- **Search**: SQLite FTS5 (coming in v0.2.0)
- **Protocol**: MCP (Model Context Protocol)
- **License**: MIT

### Known Limitations
- `update_note` and `delete_note` not yet implemented (planned for v0.2.0)
- Full-text search returns placeholder (FTS5 integration planned for v0.2.0)
- No test coverage yet (50% target for v0.2.0)
- Alpha release - APIs may change

### Future Roadmap
- **v0.2.0**: 50% test coverage, performance benchmarks, file watcher, production error handling
- **v1.0.0**: Vector embeddings, Olima context-aware ranking, Docker image, production CI/CD

[0.1.0]: https://github.com/inchan/memory-mcp/releases/tag/v0.1.0
[0.1.0-alpha.0]: https://github.com/inchan/memory-mcp/releases/tag/v0.1.0-alpha.0
