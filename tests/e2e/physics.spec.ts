import { expect, test, type Page } from '@playwright/test';

const marbleCount = async (page: Page) => Number((await page.getByTestId('marble-count').innerText()).match(/\d+/)![0]);
const noteCount = async (page: Page) => Number((await page.getByTestId('note-count').innerText()).match(/\d+/)![0]);

const gentleSlopeDocument = {
  version: 1,
  name: 'Gentle slopes',
  music: { bpm: 40, root: 0, scale: 'major', masterVolume: 0.35, muted: false, snapNotes: false, snapDivision: 'eighth' },
  editor: { gridSnap: true },
  // Each emitter is deliberately offset by sixteen quarter-note beats.  The
  // single-step action seeds the two test marbles, while playback has a full
  // 24 seconds before it can release another one at 40 BPM.
  objects: [
    { id: 'right-emitter', type: 'emitter', x: 180, y: 240, rotation: 0, speed: 0, marbleSize: 10, division: 'quarter', beatOffset: 16, enabled: true, color: '#e9a137' },
    { id: 'right-ramp', type: 'ramp', x: 350, y: 300, rotation: 5, length: 360, friction: 0.04, bounce: 0, color: '#8b9c91' },
    { id: 'right-catcher', type: 'catcher', x: 525, y: 365, rotation: 0, width: 140, musical: true, note: 60, voice: 'marimba', volume: 0.7, color: '#7d9a8c' },
    { id: 'left-emitter', type: 'emitter', x: 1020, y: 245, rotation: 0, speed: 0, marbleSize: 5, division: 'quarter', beatOffset: 16, enabled: true, color: '#7197c8' },
    { id: 'left-ramp', type: 'ramp', x: 850, y: 300, rotation: -5, length: 360, friction: 0.04, bounce: 0, color: '#8b9c91' },
    { id: 'left-catcher', type: 'catcher', x: 675, y: 365, rotation: 0, width: 140, musical: true, note: 67, voice: 'bell', volume: 0.6, color: '#7d9a8c' },
  ],
};

test('gentle ramps carry seeded marbles downhill in both directions into musical catchers', async ({ page }) => {
  await page.addInitScript(document => {
    localStorage.setItem('marble-symphony.autosave.v1', JSON.stringify(document));
  }, gentleSlopeDocument);
  await page.goto('/');
  await expect(page.getByLabel('Project name')).toHaveValue('Gentle slopes');

  // A single step emits one marble per enabled emitter without starting the
  // transport.  This keeps the observation about the ramps, not later marbles
  // colliding with or nudging the original pair.
  await page.getByRole('button', { name: 'Single step', exact: true }).click();
  await expect.poll(() => marbleCount(page)).toBe(2);

  await page.getByRole('button', { name: 'Start music', exact: true }).click();
  await expect.poll(() => noteCount(page), { timeout: 8_000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(() => marbleCount(page), { timeout: 8_000 }).toBe(0);
  await expect(page.getByTestId('simulation-canvas')).toHaveAttribute('data-playing', 'true');
});
