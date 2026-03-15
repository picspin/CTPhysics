# Contributing to CTPhysics

Thank you for your interest in contributing!

## Workflow (Branch/PR)
- Create a feature branch from master:
  - feat/<short-name>, fix/<short-name>, docs/<short-name>, chore/<short-name>
- Keep PRs focused and small; include a clear description, screenshots (if UI), and testing notes.
- PR checklist:
  - Lint passes: pnpm lint
  - Type-check passes: pnpm typecheck
  - Unit tests pass and coverage meets thresholds: pnpm test --coverage
  - E2E tests pass (when applicable): pnpm e2e
  - No secrets in changes (check .env handling)

## Code style
- TypeScript strict mode (no implicit any; prefer explicit types).
- ESLint + Prettier enforced in CI.
- Prefer functional/stateless components when possible.
- Keep modules small; avoid cross-cutting imports that make coupling tight.

## Commit messages
- Use Conventional Commits:
  - feat: add module X
  - fix: correct dose calculator edge case
  - docs: update README with testing section
  - chore: bump dependencies
  - refactor: simplify kernel visualization flow
  - test: add Vitest specs for reconstruction filters
- Include scope when helpful: feat(ui): add contrast slider

## Testing requirements
- Unit/Integration (Vitest)
  - Add tests for new logic, edge cases, and error handling.
  - Keep coverage ≥ target (see docs/PCD_ROADMAP.md; suggested ≥ 80%).
  - Mock external requests; avoid hitting real services.
- End-to-End (Playwright)
  - Cover critical user flows (load module → configure → run → view results).
  - Stabilize with deterministic fixtures and network mocks.
  - Save artifacts (videos/screenshots) for CI runs where applicable.
  - Avoid flakiness (timeouts, racing UI states).

## E2E notes
- Prefer data-test-id attributes for stable selectors.
- Use explicit waits for UI-ready states vs. arbitrary sleep.
- Seed random inputs (if any) to keep runs reproducible.
- Keep test isolation: no shared global mutable state.

## Environment management
- Do not commit secrets. Use .env.local for local dev only.
- See docs/ENV.md for variables, examples, and deployment setup.
- For CI/Preview/Production, configure secrets via Vercel or GitHub Actions secrets.
- Optional Sentry: configure SENTRY_DSN only in non-public environments.

## Documentation
- Update README and docs where relevant (new modules, changes in behavior).
- Architecture/design updates should go to docs/ARCHITECTURE.md.

## CI hints
- Keep builds fast; cache deps; avoid heavy e2e on every push (run on PRs and master).
- Enforce lint/type/test in CI; fail early on rule violations.

## Issue reporting
- Bug reports should include reproduction steps, expected vs. actual behavior, environment info.
- Security issues: DO NOT open a public issue. See SECURITY.md for responsible disclosure.

## License
- Contributions are under the project’s license (see LICENSE).
