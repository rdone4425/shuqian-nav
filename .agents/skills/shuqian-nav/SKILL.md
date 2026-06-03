```markdown
# shuqian-nav Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `shuqian-nav` JavaScript repository. It covers file naming, import/export styles, commit message patterns, and testing approaches. Use this as a reference to maintain consistency and efficiency when contributing to the project.

## Coding Conventions

### File Naming
- Use **kebab-case** for all file names.
  - Example:  
    ```
    navigation-bar.js
    user-profile.test.js
    ```

### Import Style
- Use **relative imports** for modules within the project.
  - Example:
    ```javascript
    import { fetchData } from './utils/fetch-data.js';
    ```

### Export Style
- Use **named exports** for all module exports.
  - Example:
    ```javascript
    // In utils/fetch-data.js
    export function fetchData(url) { ... }
    ```

### Commit Message Patterns
- Commit messages are **freeform** with no strict prefix requirement.
- Keep messages concise (average 31 characters).
  - Example:
    ```
    fix navigation bar alignment
    add search feature
    ```

## Workflows

### Adding a New Feature
**Trigger:** When implementing a new feature or component  
**Command:** `/add-feature`

1. Create a new JavaScript file using kebab-case (e.g., `new-feature.js`).
2. Write your feature using named exports.
3. Import any required modules using relative paths.
4. Add or update corresponding test files (e.g., `new-feature.test.js`).
5. Commit your changes with a concise, descriptive message.

### Fixing a Bug
**Trigger:** When resolving a bug or issue  
**Command:** `/fix-bug`

1. Locate the relevant file(s) using kebab-case naming.
2. Apply the bug fix, ensuring you use named exports if modifying exports.
3. Update or add tests in `*.test.js` files to cover the fix.
4. Commit with a short, clear message describing the fix.

### Writing Tests
**Trigger:** When adding or updating tests  
**Command:** `/write-test`

1. Create or update a test file matching the pattern `*.test.js`.
2. Write tests for your functions or components (testing framework is currently unknown).
3. Ensure tests cover the main use cases and edge cases.
4. Run tests to verify correctness.

## Testing Patterns

- Test files follow the pattern: `*.test.js`
- The testing framework is not explicitly defined; check existing test files for conventions.
- Place test files alongside or near the modules they test.

  Example:
  ```
  utils/
    fetch-data.js
    fetch-data.test.js
  ```

## Commands
| Command      | Purpose                                  |
|--------------|------------------------------------------|
| /add-feature | Start workflow for adding a new feature  |
| /fix-bug     | Start workflow for fixing a bug          |
| /write-test  | Start workflow for writing or updating tests |
```
