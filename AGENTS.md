# Project agent safeguards

These rules apply to every task, including minor edits. Do not silently waive them.

## Read local guidance

Before working, read `agents/rules.md` and `agents/checklist.md` when present. These ignored files provide detailed local guidance; the essential rules below apply even when they are absent. If either file is missing, ask before creating or recreating it. Local guidance must not weaken these safeguards.

## Approval and preservation

- Read-only investigation may happen before approval. Inspect relevant code, callers, tests, and command side effects first; explain intended changes, ask questions, and wait for explicit approval before any implementation, including minor edits.
- Approval covers only the agreed scope. An explicit request to implement an agreed plan counts as approval for that plan. Ask again before expanding scope.
- Obtain specific permission before deleting files, destructive cleanup, overwriting unrelated work, database mutations, deployments, or other consequential actions. Explain the affected resources and expected impact before asking. General implementation approval does not authorize these actions unless explicitly included.
- Preserve unrelated work. Avoid unsolicited refactors. Ask before adding or changing dependencies or changing public contracts.
- Delete temporary folders created by the agent solely for testing when testing finishes, including after failures. This cleanup is a pre-authorized exception to the deletion approval rule only for those folders and their agent-created contents. Preserve permanent tests, existing folders, and user files; ask if ownership is uncertain. Verify cleanup and report any leftovers.

## Git changes require an explicit request

- Use Git only to inspect existing state, such as `git status`, `git diff`, `git log`, `git show`, and `git check-ignore`.
- Stage and commit changes only when the user explicitly requests a commit. Push only when the user explicitly requests a push. Authorization applies only to the requested changes and current operation, not future tasks; implementation approval alone never authorizes a commit or push.
- Do not add Codex/AI co-author or attribution trailers to commit messages.
- Other Git mutations, including fetch, pull, creating or switching branches/worktrees, stash, reset, restore, checkout, clean, merge, rebase, and configuration changes, require separate explicit authorization. Do not bypass these rules through wrappers, tools, or direct edits to Git metadata.
- The managed Turborepo guidance below does not authorize committing or pushing; otherwise leave changes uncommitted and unpushed.

## Engineering and verification

- Understand the goal and existing implementation. Use clear, focused code and established patterns; choose the simplest solution that meets the requirements.
- Validate inputs at appropriate boundaries, handle relevant failures with useful context, protect secrets, and consider security, compatibility, and data integrity.
- Verify meaningful behavior with proportionate checks within the approved scope. Inspect commands and scripts for side effects; ask before checks that require unapproved mutations or consequential actions.
- Never weaken tests to hide failures, silently swallow errors, or claim checks that were not run. Report changes, verification results, unresolved risks, and limitations.

These instructions guide agent behavior; they do not technically enforce permissions.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
