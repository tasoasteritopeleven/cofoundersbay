// Sentry edge configuration.
// Install @sentry/nextjs and set SENTRY_DSN to enable.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/nextjs');
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    Sentry.init({ dsn, environment: process.env.NODE_ENV, tracesSampleRate: 0.05 });
  }
} catch {
  // @sentry/nextjs not installed — Sentry disabled
}
