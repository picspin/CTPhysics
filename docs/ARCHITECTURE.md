# CTPhysics Architecture

This document consolidates and replaces the previous architecture_design.md.

## Overview
- Goals: interactive CT physics demonstrations with clear, reproducible visualizations.
- Priorities: correctness of domain demos, performance for interactivity, accessibility, and maintainability.

## High-Level Design
- Frontend app (React/Next.js, TS strict)
  - Pages/Routes for modules (Sampling, Reconstruction, Dose/Noise, MTF/NPS/NEQ)
  - Shared UI components (sliders, charts, controls)
  - Visualization layer (Canvas/WebGL/D3 depending on module needs)
- State Management
  - Local component state for UI responsiveness
  - Optional global store (e.g., React Context/Zustand) for cross-module parameters
  - Persist selected parameters to localStorage (optional)
- Data & Computation
  - Pure functions for physics calculations (testable, isolated)
  - Deterministic inputs and fixtures for validation and E2E tests
  - Avoid server-side unless needed (static computations)

## Error Handling & Observability
- Error boundaries per module
- Optional Sentry integration for production (respect privacy)
- Console warnings for invalid parameter ranges

## Performance Considerations
- Memoize intensive computations
- Use web workers (optional) for heavy tasks to keep UI responsive
- Lazy-load visualization modules
- Set performance budgets; measure with Lighthouse/Next.js metrics

## Accessibility
- Keyboard navigation, ARIA roles/labels
- High-contrast themes and scalable UI controls
- Testing: include accessibility checks where possible

## Build & Deploy
- CI: lint, type-check, unit tests, e2e (selective), build
- Vercel: PR previews and production deployments
- Environment segregation: local / preview / production; manage secrets in platform settings

## Directory Structure (example)
```
/src
  /modules
    /sampling
    /reconstruction
    /dose-noise
    /metrics   # MTF/NPS/NEQ demos
  /components
  /lib         # physics utilities & pure functions
  /styles
  /tests
/docs
  ARCHITECTURE.md
  PCD_ROADMAP.md
  ENV.md
```

## Key Decisions
- Keep physics logic in pure, testable functions for correctness and ease of validation.
- Favor client-side computation; avoid server complexity unless a clear need emerges.
- Enforce TypeScript strictness to reduce runtime errors.

## Future Work
- Deep-dive validation of metrics against references
- Web workers for heavier demos
- Progressive enhancement for older devices
