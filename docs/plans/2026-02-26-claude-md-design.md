# CLAUDE.md Design Document

**Date:** 2026-02-26
**Status:** Approved

## Goal

Create a root-level `CLAUDE.md` that enforces strict development best practices across all three FAK services. Zero tolerance for hacks, workarounds, temporary code, or sloppy work.

## Structure

Single root `CLAUDE.md` (Approach C) with clear section headers:

1. **Non-Negotiable Rules** — hard stops that apply everywhere
2. **Project Overview** — service map, ports, tech stack
3. **Commands** — build, test, lint, Docker commands per service
4. **Code Conventions** — per-service patterns (Frontend, Python, Go)
5. **Testing** — mandatory testing rules and quality bar
6. **Git Workflow** — feature branches, conventional commits, PRs
7. **Self-Correction Log** — living section updated when mistakes are made and fixed

## Key Design Decisions

- **Zero tolerance for debt markers**: No TODO, FIXME, HACK, TEMP, WORKAROUND, XXX.
- **Mandatory tests**: Every code change includes tests. No exceptions.
- **Feature branches + PR**: No direct commits to main.
- **Self-correcting document**: Claude must update the log when it makes and fixes mistakes.
- **Terse rules**: Direct statements, not explanations. The CLAUDE.md tells you what to do, not why.

## User Requirements

- Both AI discipline and cross-service consistency enforced
- Mandatory tests for all changes (set up test frameworks if missing)
- Zero tolerance for workarounds and debt markers
- Feature branches with PRs and conventional commits
- Self-correction log so mistakes are documented and not repeated
