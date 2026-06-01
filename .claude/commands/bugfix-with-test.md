---
name: bugfix-with-test
description: Workflow command scaffold for bugfix-with-test in Trilium.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /bugfix-with-test

Use this workflow when working on **bugfix-with-test** in `Trilium`.

## Goal

Fix a bug in an implementation file and add or update a corresponding test to verify the fix.

## Common Files

- `*/src/**/*.ts`
- `*/src/**/*.tsx`
- `*/src/**/*.spec.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Identify and fix the bug in the implementation file (.ts or .tsx).
- Add or update the corresponding .spec.ts test file to cover the bug scenario.
- Commit both the fix and the test together.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.