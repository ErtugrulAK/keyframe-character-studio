import { test, expect, type Page } from '@playwright/test';

/**
 * N1 — the autosave restored at startup is the history baseline, not an
 * undoable edit. In a real browser session: Ctrl+Z with zero user edits must
 * leave the restored scene intact, the undo ladder must stop AT the restored
 * scene, and redo must replay only the user's own actions. An explicit import
 * (documented contract) stays undoable — pinned here as the contrast case.
 */
const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';

function layer(id: string, name: string, x: number, zIndex: number): Record<string, unknown> {
  return {
    id, name, type: 'custom_rect',
    x, y: -40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex,
    fillColor: '#3a86ff', strokeColor: '#000000',
    fillEnabled: true, strokeEnabled: false, width: 100, height: 80,
  };
}

const KEYFRAME_FRAMES = [0, 30, 60];

/** The seeded document, mirrored exactly for the import-contrast case. */
function seedScene(): string {
  const layers = [layer('a', 'Alpha', -120, 3), layer('b', 'Beta', 20, 2), layer('c', 'Gamma', 160, 1)];
  const tracks = layers.map((entry) => ({
    id: `t_${entry.id}`,
    partId: entry.id,
    name: entry.name,
    color: '#22c55e',
    visible: true,
    locked: false,
    channels: {
      x: KEYFRAME_FRAMES.map((frame) => ({ id: `${entry.id}_x_${frame}`, frame, value: frame * 2, easing: 'linear' })),
    },
  }));
  return JSON.stringify({
    version: 1, coordinateSystem: 'project-unit-center-v1',
    name: 'N1 Restored', width: 1920, height: 1080, fps: 30, totalFrames: 90,
    layers, tracks,
  });
}

async function seedRestored(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: seedScene() },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.ue-track-row')).toHaveCount(3);
  await expect(page.locator('.keyframe-diamond')).toHaveCount(KEYFRAME_FRAMES.length * 3);
}

/** Distinct parts actually painted on the stage. */
function paintedParts(page: Page) {
  return page.evaluate(() =>
    new Set([...document.querySelectorAll('[data-part-id]')].map((el) => el.getAttribute('data-part-id'))).size);
}

/** The timeline's keyframe geometry as one stable string, for before/after equality. */
function keyframeSignature(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.keyframe-diamond')].map((node) => {
      const el = node as HTMLElement; // keyframe diamonds are DOM elements; the query narrows the shape.
      return `${el.getAttribute('data-keyframe-id')}@${el.style.left}`;
    }).join('|'));
}

test('Ctrl+Z with zero user edits cannot empty the restored project', async ({ page }) => {
  await seedRestored(page);

  const partsBefore = await paintedParts(page);
  expect(partsBefore).toBe(3);

  await page.keyboard.press('Control+z');
  await expect.poll(() => paintedParts(page), { timeout: 4000 }).toBe(3);
  await expect(page.locator('.keyframe-diamond')).toHaveCount(KEYFRAME_FRAMES.length * 3);
});

test('undo after a keyframe drag returns to the restored scene, redo replays the drag', async ({ page }) => {
  await seedRestored(page);

  const baseline = await keyframeSignature(page);

  // ONE own gesture: drag b_x_0 seventy-two pixels right on its lane.
  const key = page.locator('.keyframe-diamond[data-keyframe-id="b_x_0"]');
  const box = await key.boundingBox();
  if (!box) throw new Error('b_x_0 diamond is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(box.x + box.width / 2 + step * 12, box.y + box.height / 2);
  }
  await page.mouse.up();
  await expect.poll(() => keyframeSignature(page)).not.toBe(baseline);

  // Undo retires the gesture — the restored scene survives intact...
  await page.keyboard.press('Control+z');
  await expect.poll(() => keyframeSignature(page)).toBe(baseline);
  await expect.poll(() => paintedParts(page)).toBe(3);

  // ...one undo too many still cannot reach a pre-restore (empty) document.
  await page.keyboard.press('Control+z');
  await expect.poll(() => keyframeSignature(page)).toBe(baseline);
  await expect.poll(() => paintedParts(page)).toBe(3);

  // Redo replays only the user's own drag.
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => keyframeSignature(page)).not.toBe(baseline);
});

test('undo after a tool-created shape returns to the restored scene, not an empty document', async ({ page }) => {
  await seedRestored(page);
  expect(await paintedParts(page)).toBe(3);

  await page.getByRole('button', { name: 'Vector Shapes & Graphic Elements' }).first().click({ timeout: 3000 });
  await page.getByRole('button', { name: 'Rectangle', exact: true }).first().click({ timeout: 3000 });
  const stage = await page.locator('.stage-svg').boundingBox();
  if (!stage) throw new Error('stage svg is not visible');
  await page.mouse.move(stage.x + stage.width - 120, stage.y + stage.height - 90);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width - 200, stage.y + stage.height - 160);
  await page.mouse.up();
  await expect.poll(() => paintedParts(page)).toBe(4);

  await page.keyboard.press('Control+z');
  // The FIRST own-edit undo must land on the restored scene — never on zero.
  await expect.poll(() => paintedParts(page)).toBe(3);

  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => paintedParts(page)).toBe(4);
});

test('an explicit import stays one undoable transaction (the contrast case)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

  // Import through the real serialization boundary the header Import drives.
  await page.evaluate((value) => {
    const input = new DataTransfer();
    input.items.add(new File([value], 'n1-import.json', { type: 'application/json' }));
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error('import file input not found');
    fileInput.files = input.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  }, seedScene());

  // The report dialog, when shown, replaces the scene only on confirm.
  const confirm = page.getByRole('button', { name: /import and replace|replace project|confirm/i }).first();
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirm.click();
  }
  await expect.poll(() => paintedParts(page), { timeout: 8000 }).toBe(3);

  // Documented contract: unlike startup restore, an import IS undoable.
  await page.keyboard.press('Control+z');
  await expect.poll(() => paintedParts(page)).toBe(0);
});

test('a restored legacy AnimationProject autosave is the baseline as well (N1 review, cases A+B)', async ({ page }) => {
  // Real legacy shape (string version, characterParts/tracks), with keyframes
  // and channel keys that OMIT ids — the validator-accepted inputs that used
  // to crash the legacy startup apply after its setters had run.
  const legacyCharacterParts = ['l1', 'l2', 'l3'].map((id, index) => ({
    id,
    name: `Legacy ${index}`,
    type: 'custom_rect',
    zIndex: 3 - index,
    baseTransform: { x: -120 + index * 140, y: -40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    width: 100,
    height: 80,
    fillColor: '#3a86ff',
    strokeColor: '#000000',
  }));
  const legacyDocument = JSON.stringify({
    version: '5.0',
    idCounter: 12,
    fps: 30,
    totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    lastSavedTime: new Date().toISOString(),
    characterParts: legacyCharacterParts,
    tracks: legacyCharacterParts.map((part) => ({
      id: `t_${part.id}`,
      partId: part.id,
      name: part.name,
      color: '#22c55e',
      keyframes: KEYFRAME_FRAMES.map((frame) => ({
        frame,
        transform: { x: frame * 2, y: -40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      })),
      channels: {
        x: KEYFRAME_FRAMES.map((frame) => ({ frame, value: frame * 2, easing: 'linear' })),
      },
    })),
  });

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(
    (payload: { key: string; value: string }) => localStorage.setItem(payload.key, payload.value),
    { key: STORAGE_KEY, value: legacyDocument },
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
  // Fully applied, not half-restored: every legacy layer painted, every track row and diamond present.
  await expect(page.locator('.ue-track-row')).toHaveCount(3);
  await expect(page.locator('.keyframe-diamond')).toHaveCount(KEYFRAME_FRAMES.length * 3);
  expect(await paintedParts(page)).toBe(3);

  await page.keyboard.press('Control+z');
  await expect.poll(() => paintedParts(page), { timeout: 4000 }).toBe(3);
  await expect(page.locator('.ue-track-row')).toHaveCount(3);
});
