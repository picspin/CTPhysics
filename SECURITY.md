# Security Policy

## Reporting a Vulnerability
- Please do NOT open a public GitHub issue for security vulnerabilities.
- Instead, email a detailed report to: security@picspin.dev
  - Include steps to reproduce, affected versions/commits, environment, and potential impact.
  - If applicable, provide a minimal proof-of-concept.
- Alternatively, use GitHub Security Advisories (Private) to contact maintainers.
- We aim to acknowledge within 72 hours and provide a remediation timeline after triage.

## Supported Versions
- Actively supported for security fixes:
  - Latest master branch
  - Most recent stable release
- We may backport critical fixes to the previous minor version at maintainers’ discretion.

## Disclosure Policy
- We follow responsible disclosure:
  - Coordinate privately until a fix is available.
  - Publish advisories and changelog notes after remediation.
  - Credit reporters if desired.

## Secret Scanning & Push Protection
- The repository enables GitHub Secret Scanning and (recommended) Push Protection.
- Do not commit secrets. Use .env.local for local development only.
- Rotate any leaked credentials immediately; report the incident via the process above.

## Dependency Hygiene
- Use Dependabot/Renovate to keep dependencies updated.
- Address known CVEs promptly; upgrade or patch when feasible.

## Hardening Notes
- Prefer explicit type-safety; validate inputs for interactive modules.
- Avoid sending sensitive data to third-party services (including observability).
- Review PRs for potential data exposure or misuse.
