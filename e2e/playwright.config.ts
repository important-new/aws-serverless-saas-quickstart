import { defineConfig } from '@playwright/test';

// Each app's built dist is served on its own port; Playwright starts these
// before the tests and reuses them locally.
const apps = [
  { dir: '../client/Landing/dist', port: 4300 },
  { dir: '../client/Application/dist', port: 4301 },
  { dir: '../client/Admin/dist', port: 4302 },
];

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: { headless: true },
  webServer: apps.map((a) => ({
    command: `node serve.mjs ${a.dir} ${a.port}`,
    url: `http://localhost:${a.port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  })),
});
