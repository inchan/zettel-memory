# Documentation Style Guide

Standards and conventions for writing project documentation.

---

## Document Structure

### Title and Introduction
- Start with a clear H1 title
- Add a brief one-line description below the title
- Use a horizontal rule (`---`) to separate the introduction from content

### Section Organization
- Use H2 (`##`) for main sections
- Use H3 (`###`) for subsections
- Separate major sections with horizontal rules (`---`)
- Keep section titles concise and action-oriented

### Example Structure
```markdown
# Document Title

Brief description of what this document covers.

---

## Main Section

Content here.

### Subsection

Detailed content.

---

## Another Main Section

More content.
```

---

## Writing Style

### Tone and Voice
- Use clear, direct language
- Write in present tense
- Be concise and avoid unnecessary words
- Use active voice over passive voice
- Example: "Use abstractions" not "Abstractions should be used"

### Bullet Points
- Start bullet points with action verbs or clear statements
- Keep bullets parallel in structure
- Use sub-bullets sparingly for clarity
- End bullets with periods only if they're complete sentences

### Technical Terms
- Define acronyms on first use
- Use backticks for code elements: `variable`, `function()`
- Use **bold** for emphasis on important concepts
- Use *italics* sparingly for subtle emphasis

---

## Code Examples

### Formatting
- Use fenced code blocks with language identifiers
- Keep examples short and focused
- Add comments to explain non-obvious parts
- Show both good and bad examples when illustrating concepts

### Example Format
```rust
// Good example: Clear and focused
fn read_config(path: &Path) -> Result<Config> {
    // Implementation
}

// Bad example: Too complex
fn do_everything(path: &Path, validate: bool, backup: bool) -> Result<Config> {
    // Avoid this approach
}
```

---

## Lists and Organization

### When to Use Lists
- Use bulleted lists for unordered items
- Use numbered lists for sequential steps or prioritized items
- Limit lists to 5-7 items for readability
- Break long lists into subsections

### List Structure
- Start each item with a consistent grammatical structure
- Keep items roughly equal in length and depth
- Use sub-items to provide details or examples
- End with "Benefits:" or "Example:" sections when applicable

---

## Special Sections

### Benefits Sections
- Clearly label benefits with "Benefits:" prefix
- Use bullet points for multiple benefits
- Keep benefit statements concise
- Focus on practical outcomes

Example:
```markdown
- Benefits: easier testing, clearer code purpose, simpler maintenance
```

### Summary Sections
- Place summaries at the end of documents
- Highlight key takeaways
- Include a memorable closing statement
- Use bold for emphasis

Example:
```markdown
## Summary

Following these principles results in:
- Clear, maintainable documentation
- Better team collaboration
- Faster onboarding for new contributors

**Remember: Good documentation is simple, clear, and purposeful.**
```

---

## Formatting Conventions

### Emphasis
- Use **bold** for important terms and concepts
- Use `code formatting` for technical terms, file names, commands
- Use *italics* rarely, only for subtle emphasis

### Links and References
- Use descriptive link text, not "click here"
- Reference other documents with relative paths
- Format references clearly: `[Document Name](./path/to/document.md)`

### Code and Commands
- Inline code: Use single backticks for `commands`, `variables`, `file.txt`
- Code blocks: Use triple backticks with language identifiers
- Command examples: Show the full command with expected output when helpful

---

## Content Guidelines

### Be Specific
- Provide concrete examples over abstract concepts
- Use "Example:" to introduce illustrations
- Include realistic scenarios from the project

### Stay Focused
- One main idea per section
- Remove redundant information
- Link to other documents instead of repeating content
- Keep documents under 200 lines when possible

### Update Regularly
- Review documents when making significant changes
- Keep examples current with codebase
- Remove outdated information promptly
- Add version or last-updated notes for rapidly changing content

---

## Document Types

### Reference Documents
- Focus on "what" and "where"
- Use tables for structured information
- Provide quick lookup capability
- Example: ARCHITECTURE.md

### Guide Documents
- Focus on "how" and "why"
- Use step-by-step instructions
- Include examples and best practices
- Example: DEVELOPMENT_GUIDELINES.md

### Overview Documents
- Focus on "what" and "why"
- Link to detailed documents
- Keep very concise
- Example: CLAUDE.md

---

## Summary

Following this style guide results in:
- Consistent, professional documentation
- Easier navigation and comprehension
- Better maintainability over time
- Improved collaboration across team members

**Remember: Good documentation is clear, consistent, and purposeful.**
