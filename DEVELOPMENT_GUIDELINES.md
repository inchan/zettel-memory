# Development Guidelines

Development guidelines and best practices for this project.

---

## Core Principles

This project follows industry-standard software engineering principles:

- **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **DRY (Don't Repeat Yourself)**: Extract repeated patterns into reusable components
- **KISS (Keep It Simple)**: Favor simple solutions over complex ones
- **YAGNI (You Aren't Gonna Need It)**: Implement only what's needed now
- **TDD (Test-Driven Development)**: Write tests first, follow Red-Green-Refactor cycle

For detailed explanations, Rust-specific examples, code review checklists, and refactoring patterns, see the [development-guidelines skill](../.claude/skills/development-guidelines/SKILL.md).

---

## SDD + TDD Integration

Specification-Driven Development (SDD) combined with Test-Driven Development (TDD) for high-quality code.

### Workflow: Spec → Test → Code (STC)

SDD extends TDD by adding a specification phase before testing:

```
1. [Spec] Write RFC/ADR → Define what to build and why
2. [Test] Define test cases from spec → Clarify acceptance criteria
3. [Code] TDD Cycle (Red-Green-Refactor) → Implement with tests
4. [Review] Validate against spec → Ensure compliance
5. [Iterate] Update spec if needed → Keep docs synchronized
```

### When to Write RFC vs ADR

**RFC (Request for Comments)**: Use for new features
- New functionality or modules
- API/interface changes
- Complex refactoring plans
- User-facing changes

**ADR (Architecture Decision Record)**: Use for technical decisions
- Technology stack choices (libraries, frameworks)
- Architecture pattern selections
- Data format decisions (JSON, TOML, YAML)
- Trade-off decisions

### Integration with TDD

SDD and TDD work together seamlessly:

1. **Spec First**: RFC/ADR defines requirements and design
2. **Test From Spec**: Derive test cases from specification
3. **TDD Cycle**: Implement using Red-Green-Refactor
4. **Validate Against Spec**: Ensure implementation matches spec
5. **Update Spec**: Document any deviations or lessons learned

### Benefits

- **Clear Requirements**: RFC/ADR provides concrete specification
- **Testable Design**: Specs include test strategy
- **Documentation**: Code and docs stay synchronized
- **AI Collaboration**: Enables effective work with AI agents (Claude Code, etc.)
- **Traceability**: Link decisions to implementation

### Example Workflow

```rust
// 1. RFC defines the interface
// docs/specs/rfcs/0001-cli-interface.md:
//
// ```rust
// pub struct SyncCommand {
//     pub agent: Option<String>,
// }
// impl CommandHandler for SyncCommand {
//     fn execute(&self) -> Result<()>;
// }
// ```

// 2. Write failing test (Red)
#[test]
fn test_sync_executes_successfully() {
    let cmd = SyncCommand { agent: None };
    assert!(cmd.execute().is_ok());  // Fails - not implemented
}

// 3. Minimal implementation (Green)
impl CommandHandler for SyncCommand {
    fn execute(&self) -> Result<()> {
        Ok(())  // Test passes
    }
}

// 4. Refactor with actual logic
impl CommandHandler for SyncCommand {
    fn execute(&self) -> Result<()> {
        let config = ConfigManager::load()?;
        self.sync_files(&config)?;
        Ok(())
    }
}
```

### When NOT to Write Specs

Keep it simple - not every task needs a spec:

- ✅ **Complex feature**: Write RFC
- ✅ **Technology choice**: Write ADR
- ⚠️ **Simple function**: TDD only, no spec
- ⚠️ **Bug fix**: TDD only, no spec
- ⚠️ **Minor refactoring**: TDD only, no spec

**KISS Principle**: Only write specs when complexity or decision impact justifies the documentation effort.

### Resources

- [Specifications Guide](./docs/specs/README.md) - How to write RFC/ADR
- [SDD+TDD Workflow](./docs/workflows/SDD_TDD_WORKFLOW.md) - Detailed process
- [RFC Examples](./docs/specs/rfcs/) - Sample feature RFCs
- [ADR Examples](./docs/specs/adrs/) - Sample decision records

---

## Summary

Following these principles results in:
- Maintainable, extendable code
- Fewer bugs and faster debugging
- Better team collaboration
- Professional quality standards
- Clear documentation and decision tracking

**Remember: Good code is simple, clear, and purposeful.**
