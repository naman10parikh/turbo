// Playwright config for the turbo cockpit E2E (CP123 Cluster G / G29).
//
// turbo is a zero-dep backend tool: Playwright is NOT a turbo dependency (no lockfile churn,
// honors PLAN §7 "no deps beyond the pins"). The specs run through the *already-installed*
// Playwright on the box (resolved via NODE_PATH to the shared toolchain). Run with:
//   bash tests/e2e/run.sh          (sets NODE_PATH + a free port, then `npx playwright test`)
//
// The cockpit is booted automatically by the `webServer` block below — a clean-dir E2E.

import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.TURBO_WEB_PORT || "7811";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // one cockpit instance; keep ordering deterministic
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    screenshot: "off", // we take named screenshots explicitly for the chairman
    viewport: { width: 1400, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node web/server.mjs`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { TURBO_WEB_PORT: PORT },
  },
});
