/**
 * Takes the README screenshots from the real app running in demo mode.
 *
 *   npm run screenshots
 *
 * It builds the app in demo mode, serves that build, drives an installed
 * browser (Edge, or Chrome if Edge is missing) with playwright-core, and writes
 * PNG files to docs/screenshots. No browser is downloaded and nothing is mocked
 * beyond the app's own demo mode.
 *
 * The demo data is dated relative to today, so the months in the pictures
 * depend on the day the script runs.
 */

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';
import { build, preview } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
// The demo build goes to a throwaway folder, so `dist` is left alone.
const buildDir = 'node_modules/.tmp/demo-build';
const PORT = 5199;

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

async function launchBrowser() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error('Neither Microsoft Edge nor Google Chrome could be started.');
}

/** A logged-in page in the given theme and size. */
async function openApp(browser, baseUrl, { theme, viewport }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    // Final values at once: no half-finished count-up or bar animation in a picture.
    reducedMotion: 'reduce',
  });
  await context.addInitScript((value) => {
    window.localStorage.setItem('price-expense-tracker.theme', value);
  }, theme);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`);
  return { context, page };
}

async function logIn(page) {
  await page.getByRole('button', { name: 'Open the demo' }).click();
  await page.getByRole('button', { name: 'Log out' }).waitFor();
  await page.locator('main h1').waitFor();
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  // Loading skeletons are gone once every region has its data.
  await page.waitForFunction(() => !document.querySelector('[role="status"] [class*="skeleton"]'));
  await page.waitForTimeout(400);
}

async function shoot(page, name, options = {}) {
  await settle(page);
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage: true, ...options });
  console.log(`  wrote docs/screenshots/${name}.png`);
}

async function main() {
  await mkdir(outDir, { recursive: true });

  await build({ root, mode: 'demo', logLevel: 'error', build: { outDir: buildDir } });
  const server = await preview({
    root,
    logLevel: 'error',
    build: { outDir: buildDir },
    preview: { port: PORT, strictPort: true },
  });
  const baseUrl = `http://localhost:${PORT}`;
  const browser = await launchBrowser();

  try {
    for (const theme of ['dark', 'light']) {
      console.log(`${theme} theme, desktop`);
      const { context, page } = await openApp(browser, baseUrl, { theme, viewport: DESKTOP });

      if (theme === 'dark') await shoot(page, 'login-dark');
      await logIn(page);
      await shoot(page, `dashboard-${theme}`);

      await page.getByRole('link', { name: 'Expenses', exact: true }).click();
      await page.getByRole('table', { name: 'Expenses' }).waitFor();
      await shoot(page, `expenses-${theme}`);

      if (theme === 'dark') {
        await page.getByRole('button', { name: 'Add expense' }).click();
        const panel = page.getByRole('dialog', { name: 'Add expense' });
        await panel.getByLabel(/^Amount/).fill('249.50');
        await panel.getByLabel('Category').selectOption({ label: 'Food' });
        await panel.getByLabel(/^Note/).fill('Lunch at Saffron Table');
        await shoot(page, 'expense-panel-dark', { fullPage: false });
        await page.keyboard.press('Escape');
      }

      await page.getByRole('link', { name: 'Budgets', exact: true }).click();
      await page.getByRole('table', { name: /^Budgets for/ }).waitFor();
      await shoot(page, `budgets-${theme}`);
      await context.close();
    }

    console.log('dark theme, phone');
    const { context, page } = await openApp(browser, baseUrl, { theme: 'dark', viewport: PHONE });
    await logIn(page);
    await shoot(page, 'phone-dashboard-dark');
    await page.getByRole('link', { name: 'Expenses', exact: true }).click();
    await page.getByRole('table', { name: 'Expenses' }).waitFor();
    await shoot(page, 'phone-expenses-dark');
    await context.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
