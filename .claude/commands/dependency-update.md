---
name: dependency-update
description: Workflow command scaffold for dependency-update in Trilium.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /dependency-update

Use this workflow when working on **dependency-update** in `Trilium`.

## Goal

Update dependencies in package.json and lock files, often to address security or compatibility.

## Common Files

- `*/package.json`
- `pnpm-lock.yaml`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit package.json to update the dependency version.
- Update pnpm-lock.yaml to reflect the new dependency tree.
- Sometimes update related test/spec files if breaking changes occur.
- Commit with a message referencing the dependency and new version.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.