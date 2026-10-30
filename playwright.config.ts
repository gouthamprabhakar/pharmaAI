import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  globalSetup: "./tests/global.setup.ts",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        launchOptions: { args: ["--disable-gpu"] },
      },
    },
  ],
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --port 3100 --hostname localhost",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
