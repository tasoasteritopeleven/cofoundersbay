// Sentry client-side configuration.
// Install @sentry/nextjs and set NEXT_PUBLIC_SENTRY_DSN to enable.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/nextjs');
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
        Sentry.browserTracingIntegration(),
      ],
      beforeSend(event: Record<string, unknown> & { user?: Record<string, unknown> }) {
        if (event.user) {
          delete event.user['email'];
          delete event.user['ip_address'];
        }
        return event;
      },
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        /^ChunkLoadError/,
        /Loading chunk \d+ failed/,
      ],
    });
  }
} catch {
  // @sentry/nextjs not installed — Sentry disabled
}
