/**
 * WP-01 real-browser user task: edit a mask's feather at frames 0/10/20 of the
 * Intro sequence, show the default Sequence unchanged, and Undo/Redo — with the
 * Inspector, the renderer's feather filter and the saved JSON in agreement.
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { evidenceDir, imageLayer, normalizedRectPath, savedScene, seedScene, seekFrame, SEQUENCES, track, watchPage } from './fixtures';

const OUT = evidenceDir('wp01');
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

const featherInput = (page: Page) => page.getByLabel('Mask feather');
/** The renderer's feather for mask m1 (stdDeviation = feather / 2), or 0 when no filter is drawn. */
const renderedFeather = (page: Page) => page.evaluate(() => {
  const blur = document.querySelector('filter[id^="kcs-layer-mask-filter-kcs-layer-mask-landscape-m1"] feGaussianBlur');
  return blur ? Number(blur.getAttribute('stdDeviation')) * 2 : 0;
});

const introKeys = (scene: Record<string, any>) => (scene.tracks[0].maskChannels['m1:feather'] as any[])
  .filter((key) => key.templateId === 'Intro')
  .map((key) => [key.frame, key.value]);

test('WP-01 — feather authored per sequence at frames 0/10/20 with one-step Undo/Redo', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const watch = watchPage(page);
  await seedScene(page, {
    motionTemplates: SEQUENCES,
    activeTemplateId: 'Sequence',
    layers: [imageLayer({ masks: [{ id: 'm1', name: 'Window', mode: 'add', enabled: true, feather: 2, opacity: 1, expansion: 0, path: normalizedRectPath(0.2, 0.15, 0.8, 0.85) }] })],
    tracks: [track('landscape', {
      maskChannels: {
        'm1:feather': [
          { id: 'seq0', frame: 0, value: 5, easing: 'linear', templateId: 'Sequence' },
          { id: 'intro0', frame: 0, value: 0, easing: 'linear', templateId: 'Intro' },
          { id: 'intro20', frame: 20, value: 40, easing: 'linear', templateId: 'Intro' },
        ],
      },
    })],
  });

  await page.locator('.ue-track-row', { hasText: 'Landscape' }).first().click();
  await page.getByRole('button', { name: 'Expand LAYER MASKS' }).click();
  await expect(featherInput(page)).toHaveValue('5');
  expect(await renderedFeather(page)).toBeCloseTo(5);
  await shot(page, '01_sequence_f0_before');

  await page.locator('.timeline-seq-tab').filter({ hasText: 'Intro' }).click();
  await expect(featherInput(page)).toHaveValue('0');

  // Frame 0: exact Intro key → updated in place.
  await featherInput(page).fill('4');
  await seekFrame(page, 10);
  // Frame 10 between Intro keys (4 → 40, linear) reads 22; the edit inserts a key.
  await expect(featherInput(page)).toHaveValue('22');
  expect(await renderedFeather(page)).toBeCloseTo(22);
  await shot(page, '02_intro_f10_before_edit');
  await featherInput(page).fill('30');
  await expect(featherInput(page)).toHaveValue('30');
  expect(await renderedFeather(page)).toBeCloseTo(30);
  await shot(page, '03_intro_f10_after_edit');

  await seekFrame(page, 20);
  await featherInput(page).fill('50');
  expect(await renderedFeather(page)).toBeCloseTo(50);
  await shot(page, '04_intro_f20_after_edit');

  let scene = await savedScene(page);
  expect(introKeys(scene)).toEqual([[0, 4], [10, 30], [20, 50]]);
  expect(scene.tracks[0].maskChannels['m1:feather'].find((key: any) => key.id === 'seq0')).toMatchObject({ frame: 0, value: 5, templateId: 'Sequence' });
  // The base mask keeps its own feather: no evaluated value was copied onto it.
  expect(scene.layers[0].masks[0].feather).toBe(2);

  // One Undo reverts exactly the frame-20 edit; Redo re-applies it.
  await page.getByTitle('Undo').click();
  await expect(featherInput(page)).toHaveValue('40');
  expect(await renderedFeather(page)).toBeCloseTo(40);
  await shot(page, '05_intro_f20_undo');
  scene = await savedScene(page);
  expect(introKeys(scene)).toEqual([[0, 4], [10, 30], [20, 40]]);

  await page.getByTitle('Redo').click();
  await expect(featherInput(page)).toHaveValue('50');
  await shot(page, '06_intro_f20_redo');

  // The default Sequence is unchanged.
  await page.locator('.timeline-seq-tab').filter({ hasText: 'Sequence' }).first().click();
  await expect(featherInput(page)).toHaveValue('5');
  expect(await renderedFeather(page)).toBeCloseTo(5);
  await shot(page, '07_sequence_unchanged');

  // Add mask next to existing IDs gets a fresh ID.
  await page.getByRole('button', { name: 'Add mask' }).click();
  scene = await savedScene(page);
  expect(scene.layers[0].masks.map((mask: any) => mask.id)).toEqual(['m1', 'mask-2']);

  expect(watch.errors).toEqual([]);
});
