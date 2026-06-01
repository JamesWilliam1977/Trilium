```markdown
# Trilium Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill provides a comprehensive guide to contributing to the Trilium codebase, a TypeScript project with a focus on modularity, test coverage, and maintainability. It outlines the project's coding conventions, common workflows (including increasing test coverage, updating dependencies, and bugfixing with tests), and testing patterns. Whether you're a new contributor or looking to streamline your workflow, this guide will help you follow established patterns and best practices.

## Coding Conventions

- **Language:** TypeScript
- **Framework:** None detected
- **File Naming:** Use `camelCase` for file and directory names.
  - Example: `userService.ts`, `noteManager.spec.ts`
- **Import Style:** Use relative imports.
  - Example:
    ```typescript
    import { getUser } from './userService';
    ```
- **Export Style:** Mixed (both named and default exports are used).
  - Named export:
    ```typescript
    export function getUser(id: string) { ... }
    ```
  - Default export:
    ```typescript
    export default NoteManager;
    ```
- **Commit Messages:** Use [Conventional Commits](https://www.conventionalcommits.org/) with prefixes like `fix`, `test`, `chore`, `refactor`.
  - Example: `fix: handle null notes in noteManager`

## Workflows

### Increase Test Coverage
**Trigger:** When you want to improve test coverage for a module, service, or utility  
**Command:** `/increase-coverage`

1. Identify modules, services, or utilities with low test coverage.
2. Create or update the corresponding `.spec.ts` files to add more tests.
3. If necessary, update implementation files to facilitate testing or fix minor issues.
4. Commit changes with a message indicating increased coverage.

**Example:**
```typescript
// userService.spec.ts
import { getUser } from './userService';

test('returns user by id', () => {
  expect(getUser('123').id).toBe('123');
});
```
Commit message: `test: increase coverage for userService`

---

### Dependency Update
**Trigger:** When you want to update a dependency to a newer version  
**Command:** `/update-dependency`

1. Edit `package.json` to update the dependency version.
2. Update `pnpm-lock.yaml` to reflect the new dependency tree.
3. If breaking changes occur, update related test/spec files.
4. Commit with a message referencing the dependency and new version.

**Example:**
```json
// package.json
"dependencies": {
  "lodash": "^4.18.0"
}
```
Commit message: `chore: update lodash to 4.18.0`

---

### Bugfix With Test
**Trigger:** When you want to fix a bug and ensure it is covered by tests  
**Command:** `/fix-with-test`

1. Identify and fix the bug in the implementation file (`.ts` or `.tsx`).
2. Add or update the corresponding `.spec.ts` test file to cover the bug scenario.
3. Commit both the fix and the test together.

**Example:**
```typescript
// noteManager.ts
export function getNote(id: string) {
  if (!id) return null; // Bugfix: handle missing id
  // ...
}

// noteManager.spec.ts
test('returns null for missing id', () => {
  expect(getNote(undefined)).toBeNull();
});
```
Commit message: `fix: handle missing id in getNote`

---

## Testing Patterns

- **Framework:** [Vitest](https://vitest.dev/)
- **Test File Pattern:** `*.spec.ts` (tests are colocated with source files)
- **Test Example:**
  ```typescript
  // noteManager.spec.ts
  import { getNote } from './noteManager';

  test('returns note by id', () => {
    expect(getNote('abc').id).toBe('abc');
  });
  ```
- **Run Tests:** Use Vitest CLI or configured scripts (e.g., `pnpm test`).

## Commands

| Command             | Purpose                                               |
|---------------------|-------------------------------------------------------|
| /increase-coverage  | Add or improve tests to increase code coverage        |
| /update-dependency  | Update dependencies in package.json and lock files    |
| /fix-with-test      | Fix a bug and add/update a test to verify the fix     |
```