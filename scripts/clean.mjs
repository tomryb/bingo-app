import { rm } from "node:fs/promises";

const generatedPaths = [
  "dist",
  "dist-ssr",
  "coverage",
  "server/coverage",
  "test-results",
  "playwright-report",
  "blob-report",
  "node_modules/.vite",
  "node_modules/.vite-temp",
  "node_modules/.tmp/tsconfig.app.tsbuildinfo",
  "node_modules/.tmp/tsconfig.node.tsbuildinfo",
  "node_modules/.tmp/tsconfig.tests.tsbuildinfo",
];

for (const path of generatedPaths) {
  await rm(new URL(`../${path}`, import.meta.url), {
    recursive: true,
    force: true,
  });
  console.log(`Cleaned: ${path}`);
}
