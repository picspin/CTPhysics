# CTPhysics PCD Roadmap

This roadmap outlines product, clinical/physics demonstration, and developer quality goals across four milestones (M1–M4), with QA metrics and testing targets.

## QA Metrics (Domain)
- MTF (Modulation Transfer Function): spatial resolution behavior; visualize and compute example curves.
- NPS (Noise Power Spectrum): characterize noise distribution; visualize and compare under different settings.
- NEQ (Noise Equivalent Quanta): summarize SNR-equivalent performance across frequencies.
- Targets: provide accurate, reproducible calculators/demonstrations with references; include validation notes and assumptions in docs.

## Testing Coverage Targets
- Unit/Integration (Vitest)
  - M1: ≥ 50%
  - M2: ≥ 65%
  - M3: ≥ 80%
  - M4: ≥ 90%
- End-to-End (Playwright; critical flows)
  - M1: Smoke tests for 2 core flows
  - M2: Cover 50% of critical flows
  - M3: Cover 80% of critical flows
  - M4: Cover 90%+ of critical flows; artifacts retained

## Milestones

### M1 — Foundations
- Project setup: tooling (ESLint/Prettier/TS strict), testing scaffolds (Vitest/Playwright), CI pipelines.
- Core modules baseline:
  - Sampling & simple reconstruction visualization
  - Basic dose/noise example with parameter sliders
- Docs:
  - README (CN/EN), CONTRIBUTING, SECURITY
  - ENV variables documented (docs/ENV.md)
  - Architecture outline (docs/ARCHITECTURE.md)
- Coverage:
  - Unit/Integration ≥ 50%; E2E smoke for 2 flows
- Performance/A11y:
  - Establish budgets; initial accessibility checks

### M2 — Feature Expansion
- Add reconstruction kernel exploration (e.g., soft vs. sharp filters).
- Enhance dose/noise trade-off module; include NPS visualization.
- MTF calculator demo with presets; link to references.
- i18n enhancements; content QA for CN/EN parity.
- Coverage:
  - Unit/Integration ≥ 65%; E2E ≥ 50% critical flows
- CI:
  - Preview deploys for PRs; coverage gating enabled

### M3 — Release Candidate
- Refine UI/UX; improve performance (lazy-loading, memoization).
- Expand validation: document NEQ derivations and assumptions.
- Accessibility: audit and fix main flows (keyboard, ARIA, contrast).
- Observability: optional Sentry integration; error boundaries.
- Coverage:
  - Unit/Integration ≥ 80%; E2E ≥ 80% critical flows
- Documentation:
  - Deep-dive guides for MTF/NPS/NEQ; usage examples

### M4 — Stable
- Harden modules; edge case handling; reliability improvements.
- Security checks: secret scanning and push protection enabled.
- Validation/Calibration:
  - Cross-check MTF/NPS/NEQ demos against references; document discrepancies.
- Coverage:
  - Unit/Integration ≥ 90%; E2E ≥ 90% critical flows
- Maintenance:
  - Dependency hygiene; upgrade policy; release notes template

## References & Validation Notes
- Include citations to imaging physics literature for MTF/NPS/NEQ.
- Provide example input/output and expected behavior for each demo module.
- Clarify simplifications (e.g., 1D assumptions, idealized detectors).
