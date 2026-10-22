import { expect, test, type Locator, type Page } from '@playwright/test';

const savedTempo = (page: Page) => page.evaluate(() => {
  const saved = localStorage.getItem('marble-symphony.autosave.v1');
  return saved ? JSON.parse(saved).music.bpm as number : null;
});

async function typeTempo(input: Locator, value: string) {
  await input.fill('');
  await expect(input).toHaveValue('');
  // Typing each digit catches the previous clamp-on-every-change bug: 1 became 40.
  for (let index = 0; index < value.length; index++) {
    await input.pressSequentially(value[index], { delay: 120 });
    await expect(input).toHaveValue(value.slice(0, index + 1));
  }
}

test('desktop tempo accepts a draft and commits one undoable edit on Enter or blur', async ({ page }) => {
  await page.goto('/');
  const tempo = page.getByLabel('TEMPO', { exact: true });
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  await expect(tempo).toHaveValue('96');
  await expect.poll(() => savedTempo(page)).toBe(96);
  await page.getByRole('button', { name: 'Start music', exact: true }).click();

  await typeTempo(tempo, '120');
  await expect(undo).toBeDisabled();
  expect(await savedTempo(page)).toBe(96);
  await tempo.press('Enter');
  await expect.poll(() => savedTempo(page)).toBe(120);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

  await typeTempo(tempo, '140');
  expect(await savedTempo(page)).toBe(120);
  await tempo.blur();
  await expect.poll(() => savedTempo(page)).toBe(140);
  await undo.click();
  await expect(tempo).toHaveValue('120');
  await undo.click();
  await expect(tempo).toHaveValue('96');
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(tempo).toHaveValue('120');
  await redo.click();
  await expect(tempo).toHaveValue('140');
  await page.reload();
  await expect(tempo).toHaveValue('140');

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /Bell Garden/ }).click();
  await expect(tempo).toHaveValue('48');
});

for (const { width, draft, committed } of [
  { width: 820, draft: '1', committed: 40 },
  { width: 390, draft: '999', committed: 200 },
]) {
  test(`tempo settings at ${width}px cancel drafts and clamp only when committed`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const settings = page.getByRole('button', { name: 'Project and playback settings', exact: true });
    await settings.click();
    const dialog = page.getByRole('dialog', { name: 'Project & playback', exact: true });
    const tempo = dialog.getByLabel('Tempo BPM', { exact: true });
    const undo = dialog.getByRole('button', { name: 'Undo', exact: true });
    await expect(tempo).toHaveValue('96');

    await typeTempo(tempo, '120');
    await tempo.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(tempo).toHaveValue('96');
    await expect(undo).toBeDisabled();
    await tempo.fill('');
    await tempo.blur();
    await expect(tempo).toHaveValue('96');
    await expect(undo).toBeDisabled();

    await typeTempo(tempo, '120');
    await tempo.press('Enter');
    await expect.poll(() => savedTempo(page)).toBe(120);
    await typeTempo(tempo, draft);
    expect(await savedTempo(page)).toBe(120);
    await tempo.blur();
    await expect(tempo).toHaveValue(String(committed));
    await expect.poll(() => savedTempo(page)).toBe(committed);
    await undo.click();
    await expect(tempo).toHaveValue('120');
    await dialog.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(tempo).toHaveValue(String(committed));
    await page.reload();
    await settings.click();
    await expect(tempo).toHaveValue(String(committed));
  });
}
