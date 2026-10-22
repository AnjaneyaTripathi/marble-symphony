import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.argv[2] || process.env.PREVIEW_URL || 'http://127.0.0.1:5173/';
const output = '/private/tmp/marble-symphony-preview';
await mkdir(output, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
} catch (chromeError) {
  try { browser = await chromium.launch({ headless: true }); }
  catch (fallbackError) { throw new AggregateError([chromeError, fallbackError], 'Could not launch Chrome or installed Playwright Chromium.'); }
}

const reports = [];
try {
  for (const [name, viewport, touch] of [
    ['desktop', { width: 1440, height: 1000 }, false],
    ['tablet', { width: 820, height: 1180 }, true],
    ['phone', { width: 390, height: 844 }, true],
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`.trim()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const canvas = page.getByTestId('simulation-canvas');
    await canvas.waitFor({ state: 'visible' });
    await page.screenshot({ path: `${output}/${name}-initial.png`, fullPage: true });
    const initial = await page.evaluate(() => {
      const element = document.querySelector('canvas');
      const box = element.getBoundingClientRect();
      return { title: document.title, viewport: { width: innerWidth, height: innerHeight }, page: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }, canvas: { x: box.x, y: box.y, width: box.width, height: box.height }, runtime: { ...element.dataset } };
    });
    let playing;
    if (name === 'desktop') {
      await page.getByRole('button', { name: 'Dismiss introduction' }).click();
      await page.getByRole('button', { name: 'Start music', exact: true }).click();
      await page.waitForTimeout(7000);
      await page.screenshot({ path: `${output}/${name}-playing.png`, fullPage: true });
      playing = await canvas.evaluate(element => ({ ...element.dataset }));
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
    }
    reports.push({ name, initial, playing, errors });
    await context.close();
  }
  await writeFile(`${output}/preview-report.json`, JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
