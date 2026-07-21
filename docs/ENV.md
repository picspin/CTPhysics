# Environment Variables

CTPhysics is a static-first Next.js teaching site. The current production app does not require secrets for the core simulators, reconstruction pages, PCCT views, theme switching, or local language provider.

## Local Development

Create `.env.local` only when adding optional integrations. Do not commit `.env*` files.

Common optional values:

```bash
# Optional local port override when running Next.js manually
PORT=3000

# Optional verbose Next.js/OpenTelemetry diagnostics
NEXT_OTEL_VERBOSE=1
NEXT_OTEL_PERFORMANCE_PREFIX=ctphysics-dev
```

## Production / Vercel

No required environment variables are needed for the current production deployment.

Optional integrations:

```bash
# Optional Sentry client/runtime configuration, only if Sentry is later enabled
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

Keep optional monitoring keys in Vercel Project Settings, not in repository files.
