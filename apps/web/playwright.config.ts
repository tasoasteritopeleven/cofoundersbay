import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.A11Y_PORT ?? 3100);
const BASE_URL = process.env.A11Y_BASE_URL ?? `http://localhost:${PORT}`;
/**
 * Must match the NEXT_PUBLIC_API_URL the app was built with — that value is
 * inlined at build time and is also interpolated into the CSP connect-src, so a
 * mismatch here means the browser blocks every request the app makes.
 */
const MOCK_API_PORT = Number(process.env.MOCK_API_PORT ?? 3001);

/**
 * Accessibility regression suite.
 *
 * Runs against a real production build rather than `next dev`, because several
 * of the things under test — the CSP, the security headers, the middleware auth
 * redirect, the self-hosted font faces — only exist in a production render.
 */
export default defineConfig({
  testDir: './e2e',
  // The authenticated a11y tests poll for up to 45s (see the note there);
  // the per-test budget has to leave room for navigation on top of that.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  // The authenticated suite needs an API to render at all, so both servers come
  // up together. The stub is a fixture (e2e/mock-api.mjs), not a mock framework.
  webServer: process.env.A11Y_BASE_URL
    ? undefined
    : [
        {
          command: `node e2e/mock-api.mjs ${MOCK_API_PORT}`,
          port: MOCK_API_PORT,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
        {
          command: `npx next start --port ${PORT}`,
          port: PORT,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
});
