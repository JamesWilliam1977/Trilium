---
name: increase-test-coverage
description: Workflow command scaffold for increase-test-coverage in Trilium.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /increase-test-coverage

Use this workflow when working on **increase-test-coverage** in `Trilium`.

## Goal

Increase code coverage by adding or improving tests for existing modules or services.

## Common Files

- `*/src/**/*.spec.ts`
- `*/src/**/*.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Identify modules/services/utilities with low test coverage.
- Create or update corresponding .spec.ts files to add more tests.
- Sometimes update implementation files to facilitate testing or fix minor issues.
- Commit changes with a message indicating increased coverage.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.