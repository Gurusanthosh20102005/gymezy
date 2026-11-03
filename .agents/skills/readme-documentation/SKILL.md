---
name: readme-documentation
description: 'Maintains README.md and setup documentation: standard section structure, environment variable table, scripts, project structure, and keeping docs in sync with code. Use when creating or updating a README, documenting setup, install steps, scripts, environment variables or architecture, and whenever a change adds, renames or removes a dependency, script, env var, feature, folder or layer that the docs should reflect, even if the user did not ask for documentation.'
---

# README and Project Documentation

Keep the project's `README.md` and related documentation accurate, readable and well structured. The README is the entry point for any new developer: someone should be able to clone the repository and run the project from it alone.

## Objectives

1. **Entry point:** clear, concise, accurate.
2. **Continuous sync:** whenever a feature, environment variable, dependency, script or folder is added, changed or removed, the README is updated in the same change.
3. **Scannable Markdown:** tables, fenced code blocks and short lists instead of walls of text.
4. **Truthful:** every command and path in the README exists and works. Read `package.json`, `Makefile`, `pyproject.toml`, `docker-compose.yml`, `.env.example` and the actual folder tree before writing about them, and never invent a script or flag. If you could not run a command, say so rather than implying it was tested.

## 1. Standard README structure

When generating or fully rewriting a `README.md`, follow this section order:

1. **Project title and description:** one H1, then a short paragraph on what the project does and the problem it solves.
2. **Tech stack:** a list of core technologies (frontend, backend, database, infrastructure).
3. **Features:** a high-level list of what the application actually does.
4. **Architecture / project structure:** a short explanation or ASCII tree of how the code is organized.
5. **Prerequisites and installation:** step-by-step terminal commands to run the project locally (install dependencies, database setup, seed data). Use the project's own package manager and tools.
6. **Environment variables:** a **mandatory** table of every variable the application reads, with its purpose, whether it is required, and a **dummy** example. Real secrets never appear. This table must match `.env.example` exactly.
7. **Usage / scripts:** how to start the dev server, build for production, run tests and lint.

Add these when they apply, after the seven above: **API documentation** (a link to the OpenAPI or docs page, or a routes table), **Testing**, **Deployment** (a pointer, not a tutorial), **Troubleshooting** (the three problems newcomers hit most), **Contributing** (link to the branch, commit and PR conventions), **License**. For UI projects a screenshot near the top helps.

## 2. Maintenance triggers

When modifying code, check whether the README needs an update:

| Change | Update |
|---|---|
| A major tool or package is added (Redis, Tailwind, Socket.io, a new database) | Tech stack |
| The app needs a new environment variable to start, or one is renamed or removed | Environment variables table **and** `.env.example` |
| Scripts or commands change (`package.json` scripts, Makefile targets) | Usage / scripts |
| A folder or layer is added, moved or removed (for example a `repositories/` layer) | Project structure |
| A new endpoint family, role or major feature ships | Features and API documentation |
| Setup steps change (new service to start, new migration command, new minimum runtime version) | Prerequisites and installation |

## 3. Formatting rules

- **Code blocks:** always specify the language (`bash`, `json`, `javascript`, `yaml`) for highlighting. Commands the reader should run go in `bash` blocks without a leading `$`, so they can be copied.
- **Tables:** use Markdown tables for structured data such as environment variables, API routes and feature comparisons.
- **Headings:** a single H1; then H2 for sections and H3 for subsections, never skipping levels.
- **No walls of text:** short paragraphs, bold for key terms, lists for steps. Keep a consistent, neutral tone; no marketing language, no emoji decoration, and no badges that do not mean something.
- **Links:** relative links for files inside the repository, and descriptive link text ("setup guide", not "click here").

## 4. Output instructions

When asked to update or write documentation:

1. Do not output the whole README if only a small section changed. Give the exact Markdown snippet to add or replace, and name the section it belongs to.
2. When asked to generate a fresh `README.md`, output the complete file following the structure in section 1.
3. List anything you assumed or could not verify (an unrun command, a guessed port) so the maintainer can confirm it.

## Works together with

`git-workflow` (commit and PR conventions to link from Contributing), `api-standardization` (OpenAPI as the API reference), `single-source-of-truth` (the environment table documents the one validated config module), `professional-engineering-standards` (documentation is part of the definition of done).
