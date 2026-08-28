---
name: commit-messages
description: Write git commit messages in Conventional Commits format for Autodoc repos, where commit prefixes drive CI semver bumps. Use whenever authoring a commit - "escrever commit", "mensagem de commit", "commit message", "conventional commits", "criar release".
---

# Commit messages (Conventional Commits)

Format is mechanical; discipline is a focused subject and a *why* body when the subject isn't enough.

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type** — `feat` | `fix` | `chore` | `docs` | `refactor` | `test` | `perf` | `style` | `build` | `ci` | `revert`.
- **scope** — optional but encouraged: module/feature area (`auth`, `api`, `i18n`, `ai-config`). If unsure, omit rather than invent.
- **subject** — imperative present ("add", not "added"), lowercase, ≤72 chars, no trailing period.
- **body** — optional, wrap at 72 cols, explains WHY. Skip when the subject is self-explanatory.
- **footer** — `BREAKING CHANGE: …`, issue refs (`Closes #123`), `Co-Authored-By:`.

## ⚠️ These prefixes are load-bearing in CI

The release pipeline computes the next semver FROM commit prefixes (`manual_new_release` workflow), with a house quirk that diverges from standard Conventional Commits:

| Prefixes | Bump |
|---|---|
| `feat`, `feature`, **`chore`** | **MINOR** (yes — `chore` is a minor here, not a no-op) |
| `fix`, `bugfix`, `perf`, `refactor`, `test(s)` | PATCH |

No commitlint enforces any of this — the discipline is social. A sloppy prefix mis-versions the release.

## Examples

```
feat(auth): allow login with corporate AD account

The legacy /login endpoint already supports AD; expose it from the UI so
domain users stop falling back to the manual form.
```

```
fix(api): retry POST /orders on 502 from upstream

The gateway intermittently returns 502 during deploys. Retry once before
surfacing the error to the user.

Closes #482
```

## Anti-patterns

- ❌ `update files` / `fix bug` / `WIP` — meaningless or unsquashed.
- ❌ `Added X` — wrong tense.
- ❌ Two unrelated changes in one commit — split.
- ❌ Subject over 72 chars — move detail to the body.

## Checklist

1. Type matches the change category (and you understand its BUMP effect).
2. Subject imperative, lowercase, ≤72.
3. Body when *why* isn't obvious.
4. Nothing unrelated bundled.
5. Footer for issues/breaking changes.
