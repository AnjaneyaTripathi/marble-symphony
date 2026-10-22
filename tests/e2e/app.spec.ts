import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const marbleCount = async (page: Page) => Number((await page.getByTestId('marble-count').innerText()).match(/\d+/)![0]);
const noteCount = async (page: Page) => Number((await page.getByTestId('note-count').innerText()).match(/\d+/)![0]);

test('production build loads from a repository subpath and starts real collision notes', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { __oscillatorsCreated: number };
    state.__oscillatorsCreated = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      state.__oscillatorsCreated++;
      return create.call(this);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const failures: string[] = [];
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  await page.goto('/marble-symphony/');
  await expect(page.getByRole('button', { name: 'Start music', exact: true })).toBeVisible();
  await expect(page.getByLabel('Marble machine canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Start music', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect.poll(() => marbleCount(page)).toBeGreaterThan(0);
  // This count is advanced by collision notes through the runtime synthesis pipeline.
  await expect.poll(() => noteCount(page), { timeout: 15_000 }).toBeGreaterThan(2);
  await expect(page.getByTestId('simulation-canvas')).toHaveAttribute('data-audio-ready', 'true');
  expect(await page.evaluate(() => (window as typeof window & { __oscillatorsCreated: number }).__oscillatorsCreated)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('pause holds state, resume skips missed releases, and reset preserves the machine', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start music', exact: true }).click();
  await expect.poll(() => marbleCount(page)).toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const before = await marbleCount(page);
  const notesBefore = await noteCount(page);
  await page.waitForTimeout(1_200);
  expect(await marbleCount(page)).toBe(before);
  expect(await noteCount(page)).toBe(notesBefore);
  await page.getByRole('button', { name: 'Resume music', exact: true }).click();
  await page.waitForTimeout(160);
  // At 96 BPM the two quarter-note emitters can release at most two marbles here.
  // Replaying the 1.2-second pause would release about four and fail this bound.
  expect(await marbleCount(page)).toBeLessThanOrEqual(before + 2);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const name = await page.getByLabel('Project name').inputValue();
  await page.getByRole('button', { name: 'Reset marbles', exact: true }).click();
  expect(await marbleCount(page)).toBe(0);
  expect(await noteCount(page)).toBe(0);
  await expect(page.getByLabel('Project name')).toHaveValue(name);
});

test('add, edit, undo, redo and delete a decorative object', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Text label', exact: true }).click();
  const canvas = page.getByLabel('Marble machine canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await canvas.click({ position: { x: bounds!.width * 0.55, y: bounds!.height * 0.45 } });
  const text = page.getByLabel('Label text');
  await expect(text).toBeVisible();
  await text.fill('A tiny melody');
  await text.blur();
  await page.getByLabel('Position X', { exact: true }).fill('610');
  await page.getByLabel('Position X', { exact: true }).blur();
  await expect(page.getByLabel('Position X', { exact: true })).toHaveValue('610');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('listitem').filter({ hasText: 'A tiny melody' }).click();
  await expect(page.getByLabel('Position X', { exact: true })).not.toHaveValue('610');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('listitem').filter({ hasText: 'A tiny melody' }).click();
  await expect(page.getByLabel('Position X', { exact: true })).toHaveValue('610');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(text).toHaveCount(0);
});

test('local recovery and portable export/import preserve the actual document', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Project name').fill('My portable marble machine');
  await page.getByLabel('Project name').blur();
  await page.getByRole('button', { name: 'Save & share', exact: true }).click();
  await page.getByRole('button', { name: 'Save locally', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Export JSON/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const document = JSON.parse(await readFile(path!, 'utf8'));
  expect(document.name).toBe('My portable marble machine');
  expect(document.objects.length).toBeGreaterThan(5);
  expect(document).not.toHaveProperty('marbles');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('marble-symphony.autosave.v1') || '{}').name)).toBe(document.name);
  await page.reload();
  await expect(page.getByLabel('Project name')).toHaveValue(document.name);
  await page.getByLabel('Project name').fill('Changed after export');
  await page.getByLabel('Project name').blur();
  await page.getByRole('button', { name: 'Save & share', exact: true }).click();
  page.on('dialog', dialog => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles(path!);
  await expect(page.getByLabel('Project name')).toHaveValue(document.name);
});

for (const preset of ['Bell Garden', 'Percussion Playground']) {
  test(`${preset} produces physical instrument impacts`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(preset) }).click();
    await expect(page.getByLabel('Project name')).toHaveValue(preset);
    await page.getByRole('button', { name: 'Start music', exact: true }).click();
    await expect.poll(() => noteCount(page), { timeout: 15_000 }).toBeGreaterThan(2);
    await expect(page.getByTestId('simulation-canvas')).toHaveAttribute('data-audio-ready', 'true');
  });
}

test('a shared machine can be edited and recovered without reopening the original link', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save & share', exact: true }).click();
  await page.getByRole('button', { name: /^Create a share link/ }).click();
  const url = await page.getByLabel('Share link', { exact: true }).inputValue();
  expect(url).toContain('#machine=');
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page).not.toHaveURL(/#machine=/);
  await page.getByLabel('Project name').fill('Edited shared machine');
  await page.getByLabel('Project name').blur();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('marble-symphony.autosave.v1') || '{}').name)).toBe('Edited shared machine');
  await page.reload();
  await expect(page.getByLabel('Project name')).toHaveValue('Edited shared machine');
  // Pasting a fragment into an already open tab must handle protected recovered work.
  page.once('dialog', dialog => dialog.dismiss());
  await page.evaluate(link => { window.location.hash = new URL(link).hash; }, url);
  await expect(page).not.toHaveURL(/#machine=/);
  await expect(page.getByLabel('Project name')).toHaveValue('Edited shared machine');
  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(link => { window.location.hash = new URL(link).hash; }, url);
  await expect(page.getByLabel('Project name')).toHaveValue('First Melody');
  await expect(page).not.toHaveURL(/#machine=/);
});

test('quick reload flushes pending autosave and recovered work is protected', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Project name').fill('Saved before the debounce');
  await page.getByLabel('Project name').blur();
  await page.reload();
  await expect(page.getByLabel('Project name')).toHaveValue('Saved before the debounce');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: /Bell Garden/ }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('Saved before the debounce');
});

test('unavailable browser storage keeps editing and portable export usable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () { throw new DOMException('Storage disabled', 'SecurityError'); };
    Storage.prototype.setItem = function () { throw new DOMException('Storage disabled', 'SecurityError'); };
  });
  await page.goto('/');
  await page.getByLabel('Project name').fill('Portable without storage');
  await page.getByLabel('Project name').blur();
  await expect(page.getByText('Local save unavailable', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save & share', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Local storage is unavailable');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Export JSON/ }).click();
  const path = await (await download).path();
  expect(JSON.parse(await readFile(path!, 'utf8')).name).toBe('Portable without storage');
});

test('audio initialization failure explains the problem and keeps real physics running', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: class { constructor() { throw new Error('Audio disabled by browser policy'); } } });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start music', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Audio is unavailable');
  await expect(page.getByTestId('simulation-canvas')).toHaveAttribute('data-audio-ready', 'false');
  await expect.poll(() => marbleCount(page)).toBeGreaterThan(1);
  await expect.poll(() => noteCount(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume music', exact: true })).toBeVisible();
});

test('reset cancels a single step waiting for the audio gesture to finish', async ({ page }) => {
  await page.addInitScript(() => {
    const original = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function () {
      return new Promise<void>((resolve, reject) => {
        const state = window as typeof window & { __releaseAudioResume?: () => Promise<void> };
        state.__releaseAudioResume = async () => {
          try { await original.call(this); resolve(); } catch (error) { reject(error); }
        };
      });
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Single step', exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as typeof window & { __releaseAudioResume?: () => Promise<void> }).__releaseAudioResume)).toBe('function');
  await page.getByRole('button', { name: 'Reset marbles', exact: true }).click();
  await page.evaluate(() => (window as typeof window & { __releaseAudioResume?: () => Promise<void> }).__releaseAudioResume!());
  await page.waitForTimeout(150);
  expect(await marbleCount(page)).toBe(0);
  expect(await noteCount(page)).toBe(0);
  await expect(page.getByTestId('simulation-canvas')).toHaveAttribute('data-playing', 'false');
});

test('malformed imports show an error and retain the current machine', async ({ page }) => {
  await page.goto('/');
  const name = await page.getByLabel('Project name').inputValue();
  await page.getByRole('button', { name: 'Save & share', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":99}') });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Project name')).toHaveValue(name);
});
