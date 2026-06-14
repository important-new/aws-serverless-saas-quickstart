import { test, expect } from '@playwright/test';

// Runtime smoke: each app must boot under Angular 20, render its shell, and
// produce no fatal JS errors. (Auth/login is not exercised — there is no free
// local Cognito; expected network/auth errors against placeholder endpoints are
// ignored. See docs/MIGRATION_VERIFICATION.md.)
const apps = [
  { name: 'Landing', url: 'http://localhost:4300', marker: 'router-outlet' },
  { name: 'Application', url: 'http://localhost:4301', marker: 'form' },
  { name: 'Admin', url: 'http://localhost:4302', marker: 'amplify-authenticator' },
];

// expected, non-fatal errors when running against scrubbed/placeholder config
const IGNORE =
  /cognito|execute-api|YOUR_API_ID|Failed to fetch|net::ERR|NotAuthorized|UserPool|JWT|token|401|403|Network/i;

for (const app of apps) {
  test(`${app.name} boots and renders without fatal errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });

    await page.goto(app.url, { waitUntil: 'domcontentloaded' });

    // Angular bootstrapped and the app shell + a key element rendered
    await expect(page.locator('app-root')).toBeAttached();
    await expect(page.locator(app.marker)).toBeAttached({ timeout: 15_000 });

    const fatal = errors.filter((e) => !IGNORE.test(e));
    expect(fatal, `unexpected runtime errors:\n${fatal.join('\n')}`).toEqual([]);
  });
}
