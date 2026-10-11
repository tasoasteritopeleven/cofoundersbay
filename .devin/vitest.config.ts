import { fileURLToPath } from 'node:url';

export default {
  root: fileURLToPath(new URL('../apps/web/', import.meta.url)),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../apps/web/src/', import.meta.url)),
      // Read the workspace package from source, not from its gitignored
      // `dist`. `pnpm --filter @cofounderbay/web test` bypasses turbo, so it
      // never triggers the dependency build -- without this, a fresh clone
      // fails on the first import of a shared module rather than on anything
      // about the test.
      '@cofounderbay/shared': fileURLToPath(new URL('../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    pool: 'forks',
    execArgv: process.allowedNodeEnvironmentFlags.has('--experimental-webstorage') ? ['--no-experimental-webstorage'] : [],
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: [fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))],
    restoreMocks: true,
    testTimeout: 60_000,
  },
};
