---
name: git-workflow
description: Conventional Commits, branch naming, pull request descriptions and safe Git practices. Use whenever the task involves a commit message, git commit, branch, merge, rebase or push commands, a pull request description, a changelog or release notes, splitting or cleaning up commits, or the user asks "what should I commit?" or "write a commit for this"; also use after finishing a code change when you would propose a commit message. Never runs destructive git commands without explicit confirmation.
---

# Git Workflow

Keep version history clean, readable and safe. Follow the **Conventional Commits** specification so history is easy to scan and changelogs and version bumps can be generated automatically. If the repository already has a different documented convention (a commitlint config, a CONTRIBUTING file), follow that one.

## 1. Commit message format

```text
<type>(<scope>): <subject>

<body: what and why, wrapped at about 72 characters>

<footer: issue references, BREAKING CHANGE>
```

**Types**

| Type | Use for | Release effect |
|---|---|---|
| `feat` | a new feature | minor |
| `fix` | a bug fix | patch |
| `docs` | documentation only | none |
| `style` | formatting that does not change meaning (whitespace, semicolons) | none |
| `refactor` | a change that neither fixes a bug nor adds a feature | none |
| `perf` | a performance improvement | patch |
| `test` | adding or correcting tests | none |
| `build` | build system or dependencies | none |
| `ci` | CI configuration and scripts | none |
| `chore` | maintenance that fits nowhere else | none |
| `revert` | reverts an earlier commit | depends |

**Scope** (optional, recommended): a noun for the part of the codebase affected (`auth`, `ui`, `database`, `billing-service`). Reuse the scopes the repository already uses.

**Subject**
- Imperative, present tense: "add", not "added" or "adds".
- Lower case first letter, no trailing period, 72 characters or fewer (50 is better).
- Describe what the change does, not the file you touched.

**Body** (when the reason is not obvious): explain why the change was needed and any trade-off. **Footer:** `Closes #123`, `Refs #45`.

**Breaking changes:** add `!` after the type or scope (`feat(api)!: remove v1 login route`) and a `BREAKING CHANGE: <what breaks and how to migrate>` footer.

## 2. Examples

- Good: `feat(auth): implement argon2id password hashing`
- Good: `fix(ui): correct padding on the billing summary card`
- Good: `refactor(database): move user queries into the repository layer`
- Good: `feat(api)!: require an Idempotency-Key header on POST /payments`
- Bad: `Added new login system` (no type, past tense, capitalized)
- Bad: `fix(auth): Fixed the JWT bug.` (past tense, capitalized, trailing period, says nothing about what changed)
- Bad: `update stuff` / `wip` / `fixes` (meaningless)

## 3. Commit hygiene

- **Atomic commits:** one logical change per commit, and each one builds and passes tests. If the diff mixes a feature, a refactor and a formatting pass, propose splitting it into separate commits.
- **Review before committing:** read `git diff --staged`. Stage deliberately (`git add -p`), not blindly.
- **Never commit:** secrets, `.env` files, tokens, private keys, credentials, large binaries, build output, `node_modules`, or personal editor files. If one slips in, rotate the secret: removing it from history does not make it safe again. Keep `.gitignore` current.
- Do not commit commented-out code, debugging output, or unrelated reformatting.

## 4. Branches and pull requests

- **Branch names:** `<type>/<short-kebab-description>`, for example `feat/password-reset`, `fix/login-redirect-loop`, optionally with a ticket ID (`feat/PAY-142-refund-flow`). Keep branches short-lived and rebased or merged from the main branch regularly.
- **Pull request title:** same format as a commit subject. **Description:** what changed and why; how it was tested; screenshots for UI changes; migrations, config or env changes; breaking changes; linked issues.
- Keep pull requests small and focused. Match the repository's merge strategy (squash, merge or rebase) instead of imposing one.

## 5. Safety rules (especially for automated agents)

- **Never run destructive commands without explicit confirmation from the user:** `git reset --hard`, `git clean -fd`, `git checkout -- .`, `git push --force`, `git branch -D`, `git rebase` on shared history.
- Never force-push to a shared or protected branch. On your own branch use `--force-with-lease`, never plain `--force`.
- Do not amend or rebase commits that are already pushed and shared.
- Do not skip hooks (`--no-verify`) or signing to get past a failing check; fix the cause.
- Never change git config, remotes or credentials unless asked.

## 6. Output instructions

When generating git commands, commit messages or PR descriptions from code changes:

1. Always give the exact command using the strict format: `git commit -m "<type>(<scope>): <subject>"`. For a body or footer, use a second `-m` per paragraph.
2. If the changes should be separate commits, list them in order with the files each one stages.
3. For pull requests, output the title and a description following section 4.
4. Say what you could not verify (for example "I did not run the tests before suggesting this commit").

## Works together with

`readme-documentation` (docs commits and changelog), `clean-code-sonarqube-guard` (secrets never committed), `professional-engineering-standards` (definition of done).
