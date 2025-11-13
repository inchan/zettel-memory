---
name: development-guidelines
description: This skill provides guidance on applying SOLID, DRY, KISS, YAGNI, and TDD principles to the ai-cli-syncer Rust project. Should be invoked when planning features, implementing code, reviewing changes, or refactoring to ensure adherence to established design principles and test-driven development practices.
---

# Development Guidelines

## Overview

This skill provides procedural guidance for applying core software engineering principles to the ai-cli-syncer Rust project. Apply SOLID design patterns, Test-Driven Development (TDD), and simplicity principles (DRY, KISS, YAGNI) to maintain high code quality and maintainability.

## When to Use This Skill

This skill should be invoked when:
- **Planning new features** - Designing modules following SOLID principles before implementation
- **Writing code** - Applying SRP, DIP, and other patterns to maintain clean architecture
- **Implementing tests** - Following TDD cycle (Red-Green-Refactor) for all functionality
- **Code review** - Verifying adherence to development principles and best practices
- **Refactoring** - Identifying and eliminating principle violations (bloated classes, tight coupling, repeated code)
- **Resolving design questions** - Determining proper abstraction levels and module responsibilities

## Core Development Principles

### SOLID Principles

Apply these five design principles to Rust code:

1. **Single Responsibility (SRP)** - Each module/struct has one clear purpose
   - Separate file I/O operations from business logic
   - Keep repository structs focused on data operations only
   - Isolate validation logic into dedicated validator modules
   - Example: Split `ConfigManager` into `ConfigReader` and `ConfigValidator`
   - **Benefits**: Easier testing, clearer code purpose, simpler maintenance

2. **Open/Closed (OCP)** - Design for extension through traits, not modification
   - Define trait abstractions for contracts
   - Extend functionality by implementing new types
   - Example: Create `SyncStrategy` trait, then implement `FileSyncStrategy`, `McpSyncStrategy`
   - **Benefits**: Reduces bugs in existing code, safer to add features

3. **Liskov Substitution (LSP)** - Trait implementations must be substitutable
   - Ensure all implementations honor trait contracts
   - Don't throw unexpected errors in trait methods
   - Example: All `ConfigLoader` implementations must handle missing files consistently
   - **Benefits**: Predictable behavior, safer inheritance hierarchies

4. **Interface Segregation (ISP)** - Create focused traits, not monolithic ones
   - Split large traits into smaller, specific traits
   - Structs implement only the traits they need
   - Example: Split `FileHandler` into `FileReader`, `FileWriter`, `FileValidator`
   - **Benefits**: More flexible code, easier to implement and test

5. **Dependency Inversion (DIP)** - Depend on trait abstractions, inject implementations
   - High-level modules depend on trait abstractions
   - Use dependency injection for concrete implementations
   - Example: `SyncEngine` depends on `trait ConfigLoader`, not `JsonConfigLoader`
   - **Benefits**: Easier testing with mocks, flexible architecture, decoupled code

### TDD (Test-Driven Development)

Follow the Red-Green-Refactor cycle for all feature development:

1. **Red** - Write a failing test for the desired functionality
   - Test should compile but fail assertion
   - Verify test actually fails before proceeding

2. **Green** - Implement minimum code to make the test pass
   - Focus on making it work, not making it perfect
   - Don't add functionality beyond what the test requires

3. **Refactor** - Improve code while keeping tests green
   - Apply SOLID principles to clean up implementation
   - Remove duplication, improve names, simplify logic
   - Run tests after each refactor to ensure behavior preserved

**Test Structure:**
- Place unit tests in `mod tests` within each module
- Place integration tests in `tests/` directory at project root
- Follow Arrange-Act-Assert (AAA) pattern
- Use descriptive test names: `test_config_loader_returns_error_for_missing_file`

**Benefits**: Catches bugs early, provides living documentation, makes refactoring safer, builds confidence when making changes

### Simplicity Principles

- **DRY (Don't Repeat Yourself)** - Extract repeated patterns into reusable functions or modules
  - Create utility modules for common operations
  - Use Rust traits to share functionality across types
  - Avoid copy-pasting code blocks
  - **Benefits**: Less code to maintain, fewer bugs, better testing

- **KISS (Keep It Simple)** - Favor simple solutions over complex ones
  - Use standard library features before adding external crates
  - Write self-explanatory code with clear naming
  - Break complex functions into smaller, focused ones
  - **Benefits**: Easier to understand, faster to debug, lower cognitive load

- **YAGNI (You Aren't Gonna Need It)** - Implement only what's needed now
  - Don't create abstractions until multiple implementations exist
  - Avoid premature optimization
  - Don't build features for hypothetical future requirements
  - **Benefits**: Faster delivery, less code to maintain, lower complexity, easier to change

## Development Workflow

### 1. Understand the Requirement

Before coding, clarify:
- What specific problem needs solving?
- What are the acceptance criteria?
- What's the simplest solution that could work?

### 2. Plan the Design

Apply SOLID principles to planning:
- Which module should own this responsibility? (SRP)
- Is a trait abstraction needed? (DIP, OCP)
- Should existing traits be split? (ISP)
- Can implementations be substituted? (LSP)

### 3. Write the Test First (Red)

Follow TDD:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_feature_behavior() {
        // Arrange: Set up test data
        let input = "test data";

        // Act: Call the function (this doesn't exist yet!)
        let result = my_function(input);

        // Assert: Verify expected behavior
        assert_eq!(result, expected_value);
    }
}
```

Run `cargo test` - it should fail with "function not found".

### 4. Implement Minimal Solution (Green)

Write the simplest code to pass the test:
```rust
pub fn my_function(input: &str) -> ReturnType {
    // Minimum implementation to pass test
    expected_value
}
```

Run `cargo test` - it should now pass.

### 5. Refactor

Now improve the code while keeping tests green:
- Apply SOLID principles
- Remove duplication (DRY)
- Simplify complex logic (KISS)
- Add error handling with `anyhow::Context`
- Improve variable and function names

Run `cargo test` after each change to ensure behavior preserved.

### 6. Verify Principles

Before committing, check:
- ✓ **SRP**: Does each module/struct have one clear responsibility?
- ✓ **Tests**: Do all tests pass? Is behavior tested?
- ✓ **Simplicity**: Is this the simplest solution? Any unnecessary complexity?
- ✓ **DRY**: Any duplicated code that should be extracted?
- ✓ **Documentation**: Are public APIs documented with `///` comments?

## Code Review Checklist

When reviewing code, verify:

### SOLID Compliance
- [ ] Single Responsibility - Each module/struct has one purpose
- [ ] Open/Closed - Extensions use traits, not modifications
- [ ] Liskov Substitution - Implementations properly substitute traits
- [ ] Interface Segregation - Traits are focused, not bloated
- [ ] Dependency Inversion - Depends on traits, not concrete types

### Test Coverage
- [ ] Tests exist for new functionality
- [ ] Tests follow AAA pattern (Arrange-Act-Assert)
- [ ] Test names describe behavior being tested
- [ ] Tests are independent and isolated
- [ ] TDD cycle was followed (Red-Green-Refactor)

### Simplicity
- [ ] DRY - No repeated code blocks
- [ ] KISS - Solution is as simple as possible
- [ ] YAGNI - No unnecessary abstractions or features

### Code Quality
- [ ] Error handling uses `anyhow::Context`
- [ ] Public APIs have `///` doc comments
- [ ] Variable and function names are clear and descriptive
- [ ] No compiler warnings or clippy violations

## Common Refactoring Patterns

### Violation: Bloated Struct (SRP)

**Before:**
```rust
struct ConfigManager {
    // Too many responsibilities!
}

impl ConfigManager {
    fn read_file() -> Result<String> { ... }
    fn parse_json() -> Result<Config> { ... }
    fn validate() -> Result<()> { ... }
    fn sync_to_agents() -> Result<()> { ... }
}
```

**After (Apply SRP):**
```rust
struct ConfigReader;
impl ConfigReader {
    fn read(&self, path: &Path) -> Result<String> { ... }
}

struct ConfigParser;
impl ConfigParser {
    fn parse(&self, content: &str) -> Result<Config> { ... }
}

struct ConfigValidator;
impl ConfigValidator {
    fn validate(&self, config: &Config) -> Result<()> { ... }
}

struct ConfigSyncer;
impl ConfigSyncer {
    fn sync(&self, config: &Config) -> Result<()> { ... }
}
```

### Violation: Tight Coupling (DIP)

**Before:**
```rust
struct SyncEngine {
    loader: JsonConfigLoader, // Concrete type!
}
```

**After (Apply DIP):**
```rust
trait ConfigLoader {
    fn load(&self, path: &Path) -> Result<Config>;
}

struct SyncEngine<L: ConfigLoader> {
    loader: L, // Depends on abstraction
}
```

### Violation: Repeated Code (DRY)

**Before:**
```rust
fn sync_cursor() -> Result<()> {
    let path = home_dir().join(".cursor/config");
    let content = fs::read_to_string(&path)?;
    // ... sync logic
}

fn sync_windsurf() -> Result<()> {
    let path = home_dir().join(".windsurf/config");
    let content = fs::read_to_string(&path)?;
    // ... same sync logic
}
```

**After (Apply DRY):**
```rust
fn sync_agent(agent_name: &str) -> Result<()> {
    let path = home_dir().join(format!(".{}/config", agent_name));
    let content = fs::read_to_string(&path)?;
    // ... reusable sync logic
}
```

---

**Remember: Good code is simple, clear, and purposeful.**
