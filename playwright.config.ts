import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL,
    // Use the Edge that ships with Windows instead of downloading a separate browser.
    channel: "msedge",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm start",
    url: baseURL,
    reuseExistingServer: true,
  },
});
