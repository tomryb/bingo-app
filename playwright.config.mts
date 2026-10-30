import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const HOST = "127.0.0.1";
const FRONTEND_PORT = 5189;
const BACKEND_PORT = 3199;
const FRONTEND_URL = `http://${HOST}:${FRONTEND_PORT}`;
const BACKEND_URL = `http://${HOST}:${BACKEND_PORT}`;
const SERVER_START_TIMEOUT_MS = 30000;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.mts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: [
    {
      command: "node --import tsx index.ts",
      cwd: fileURLToPath(new URL("./server", import.meta.url)),
      env: { PORT: String(BACKEND_PORT) },
      url: `${BACKEND_URL}/socket.io/?EIO=4&transport=polling`,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
    {
      command: `npm run dev -- --host ${HOST} --port ${FRONTEND_PORT} --strictPort`,
      env: { VITE_SERVER_URL: BACKEND_URL },
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
  ],
});
