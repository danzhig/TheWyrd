import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * What the other engines and device profiles run (M7, and threads plan TX8): the QA sweep, the
 * smoke and search checks, and every Threads suite (the reader's threads, the Vault's, and the
 * sweep with every pair on, threads-qa). The frame-timing perf tests stay on Chromium, which alone
 * can slow the CPU through the DevTools protocol.
 */
const CROSS = /(qa|smoke|search|threads|vault-threads|threads-qa)\.spec\.ts/;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    {
      name: 'phone',
      testIgnore: /perf\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: false },
    },
    {
      name: 'desktop',
      testIgnore: /perf\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    // Cross-browser QA (M7): the QA sweep on real-device profiles and the other engines.
    // Firefox and WebKit run in CI's "browsers" job (ALL_BROWSERS=1), where they are installed.
    {
      name: 'android',
      testMatch: CROSS,
      use: { ...devices['Pixel 7'] },
    },
    ...(process.env.ALL_BROWSERS
      ? [
          {
            name: 'iphone',
            testMatch: CROSS,
            use: { ...devices['iPhone 14'] },
          },
          {
            name: 'safari',
            testMatch: CROSS,
            use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
          },
          {
            name: 'firefox',
            testMatch: CROSS,
            use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
          },
        ]
      : []),
    // Frame timing runs alone, after everything else, at phone size.
    {
      name: 'perf',
      testMatch: /perf\.spec\.ts/,
      dependencies: ['phone', 'desktop', 'android'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: false },
    },
  ],
  webServer: {
    command: `node scripts/serve-static.mjs out ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
