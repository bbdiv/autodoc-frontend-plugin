---
name: grill-me
description: Stress-test a plan or design via relentless interview before implementation - one question at a time, each with a recommended answer. Use when the user says "grill me", "faz perguntas", "valida meu plano", "stress-test this", "poke holes", or kicks off a non-trivial feature with open decisions.
---

# Grill me

Interview the user relentlessly about every aspect of the plan until shared understanding. Walk each branch of the design tree, resolving dependencies between decisions one by one.

## Rules

1. **One question at a time.** No batches. Wait for the answer before the next branch.
2. **Recommend, don't just ask.** Every question carries your suggested answer plus the tradeoff in one line.
3. **Codebase first.** If the code can answer it, read the code instead of asking.
4. **Resolve dependencies before leaves.** Ask next whatever unblocks the most other questions.
5. **Stop when the tree is resolved.** Summarize the plan and hand off to implementation (→ `feature-workflow`).

## When to use

- The user asks for it, or describes a non-trivial feature with hidden open decisions (scope, data shape, edge cases, integration points).

## When to skip

- Mechanical tasks (rename, single-file fix, obvious bug); plan already aligned; user explicitly says "just implement".

*Adapted from Matt Pocock's `grill-me` (github.com/mattpocock/skills), via the team's `.ai` boilerplate.*
