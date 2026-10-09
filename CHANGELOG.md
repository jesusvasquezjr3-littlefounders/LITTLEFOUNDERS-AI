# Changelog

All notable changes to the repository. Newest first. Updated in the same commit as the change; see [[CI-CD-AND-VERSION-CONTROL]] and the open work in [[BUILD-TASKS]].

## Unreleased

### Added

- Documentation system under `docs/` with an index ([[INDEX]]), scaffolds for product, design, engineering, security, operations and process documents, a decision log, and `scripts/check-docs.mjs` run as a pre-commit hook and in CI.
- Security tooling: vendored anti-slop Oxlint rules (`npm run lint:slop`), Strix security skills and references, rules for AI penetration testing ([[ai-pentesting]]).
- Google Analytics 4, consent-gated, next to Plausible and Umami.
- Git LFS tracking for the 3D character files.

### Changed

- The product was restarted from zero (2026-10-09). Only the landing page, the 3D characters, the pinned Supabase setup and Pulse remain; see [[DECISIONS]].
