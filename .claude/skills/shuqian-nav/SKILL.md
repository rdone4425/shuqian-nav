```markdown
# shuqian-nav Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill provides guidance on contributing to the `shuqian-nav` JavaScript codebase. It covers the project's coding conventions, file organization, import/export patterns, and testing practices. While no specific frameworks or automated workflows are detected, this guide ensures consistency and clarity for all contributors.

## Coding Conventions

### File Naming
- **Style:** camelCase
- **Example:**  
  ```
  navigationMenu.js
  userProfile.js
  ```

### Import Style
- **Relative imports** are used throughout the codebase.
- **Example:**
  ```javascript
  import { getUserData } from './userData';
  import { renderMenu } from '../components/menu';
  ```

### Export Style
- **Named exports** are preferred.
- **Example:**
  ```javascript
  // In userData.js
  export function getUserData() { ... }
  export const USER_ROLE = 'admin';
  ```

### Commit Patterns
- **Type:** Freeform (no enforced prefixes)
- **Average Length:** ~46 characters
- **Example:**
  ```
  Fix bug in navigation rendering on mobile
  Add search bar component to header
  ```

## Workflows

### Adding a New Feature
**Trigger:** When implementing a new functionality  
**Command:** `/add-feature`

1. Create a new file using camelCase naming.
2. Write your feature using relative imports for dependencies.
3. Export functions or constants using named exports.
4. Add or update relevant test files (`*.test.js`).
5. Commit with a descriptive message (no strict prefix required).

### Refactoring Existing Code
**Trigger:** When improving or restructuring code  
**Command:** `/refactor-code`

1. Identify the target file(s).
2. Apply changes, maintaining camelCase file names and relative imports.
3. Ensure all exports remain named.
4. Update or add tests if necessary.
5. Commit changes with a clear, concise message.

### Writing Tests
**Trigger:** When adding or updating tests  
**Command:** `/write-test`

1. Create or update a test file matching the `*.test.js` pattern.
2. Write test cases for your functions or components.
3. Run tests using the project's preferred method (framework not specified).
4. Commit test changes with a descriptive message.

## Testing Patterns

- **File Pattern:** Test files are named using the `*.test.js` convention.
- **Framework:** Not explicitly specified; use standard JavaScript testing practices.
- **Example:**
  ```javascript
  // userData.test.js
  import { getUserData } from './userData';

  test('should return correct user data', () => {
    const data = getUserData();
    expect(data).toHaveProperty('name');
  });
  ```

## Commands
| Command         | Purpose                                   |
|-----------------|-------------------------------------------|
| /add-feature    | Start the process of adding a new feature |
| /refactor-code  | Begin refactoring existing code           |
| /write-test     | Add or update test files                  |
```
