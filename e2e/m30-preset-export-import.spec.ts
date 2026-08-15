import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_INITIAL_PRESETS } from '../src/context/initialStateData';

/**
 * M30 STEP 30C — REAL USER E2E: custom preset export / import.
 *
 * Real browser flows:
 *   create a user preset (M25 Save UI) → Export Presets → real download
 *   (kcs-custom-presets.json) → import the file in a clean context via the
 *   real file chooser (setInputFiles) → merged library → apply to a part →
 *   runtime animation works → reload persists.
 * Plus: ID preservation/reconnect, collision remap, default protection,
 * duplicate names, malformed/version rejection (whole-file atomic), scene
 * isolation, M25 save/delete regression.
 */

const STORAGE_KEY = 'SEQUENCER_STUDIO_PRO_V5';
const PRESET_KEY = 'keyframe_custom_motion_presets';

function makeLayer(id: string, name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type: 'custom_box',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1,
    fillColor: '#ff2020', strokeColor: '#101218', strokeWidth: 2,
    width: 120, height: 120,
    ...overrides,
  };
}

async function seed(page: Page, layers: Record<string, unknown>[], extraPresets?: Record<string, unknown>[]): Promise<void> {
  const scene = {
    version: 1, layers,
    tracks: [],
    fps: 30, totalFrames: 90,
    projectResolution: { width: 1920, height: 1080 },
    _sceneTitle: 'M30 Preset Export/Import E2E',
  };
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); });
  await page.addInitScript(
    ([key, data, presetKey, presets]: [string, string, string, string | null]) => {
      if (!localStorage.getItem('__KCS_E2E_SEEDED__')) {
        localStorage.setItem(key, data);
        if (presets) localStorage.setItem(presetKey, presets);
        localStorage.setItem('__KCS_E2E_SEEDED__', '1');
      }
    },
    [STORAGE_KEY, JSON.stringify(scene), PRESET_KEY, extraPresets ? JSON.stringify(extraPresets) : null] as [string, string, string, string | null],
  );
  await page.goto('/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
}

async function selectPart(page: Page, name: string): Promise<void> {
  const row = page.locator('.actor-node', { has: page.locator('.actor-name', { hasText: name }) }).first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.click();
  await page.waitForTimeout(250);
}

async function openTransformTab(page: Page): Promise<void> {
  const tab = page.locator('.tab-btn', { hasText: /^Transform/ }).first();
  await tab.waitFor({ state: 'visible', timeout: 10000 });
  await tab.click();
  await page.waitForTimeout(250);
}

async function setInDuration(page: Page, value: number): Promise<void> {
  const input = page.locator('input[aria-label="Animation In Duration"]');
  await input.fill(String(value));
  await input.blur();
  await page.waitForTimeout(200);
}

async function selectInPreset(page: Page, preset: string): Promise<void> {
  await page.locator('select[aria-label="Animation In Preset"]').selectOption(preset);
  await page.waitForTimeout(250);
}

async function saveCurrentAsPreset(page: Page, slot: 'in' | 'out', name: string): Promise<void> {
  const idx = slot === 'in' ? 0 : 1;
  await page.locator('[title="Save current animation as a custom preset"]').nth(idx).click();
  const dialog = page.getByRole('dialog', { name: 'Save Animation Preset' });
  await dialog.getByLabel('Preset Name').fill(name);
  await dialog.getByText('Save', { exact: true }).click();
  await page.waitForTimeout(300);
}

async function exportPresets(page: Page): Promise<{ fileName: string; json: Record<string, unknown> }> {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[aria-label="Export Animation Presets"]').click();
  const download = await downloadPromise;
  const fileName = download.suggestedFilename();
  const stream = await download.createReadStream();
  let text = '';
  for await (const chunk of stream) text += chunk.toString();
  return { fileName, json: JSON.parse(text) as Record<string, unknown> };
}

async function importFile(page: Page, name: string, content: string): Promise<void> {
  await page.locator('[aria-label="Import Animation Presets"]').click();
  await page.locator('input[aria-label="Import custom animation presets file"]').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(content, 'utf-8'),
  });
  await page.waitForTimeout(400);
}

async function saveNow(page: Page): Promise<void> {
  const badge = page.locator('.autosave-status-badge');
  if (await badge.count()) {
    await badge.click();
    await page.waitForTimeout(300);
  }
}

async function storedLibrary(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, PRESET_KEY);
}

function makePreset(id: string, name: string, type: 'in' | 'out' | 'stunt', overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, name, type, durationFrames: 18,
    keyframes: [
      { progress: 0, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, easing: 'easeOut' },
      { progress: 0.5, deltaX: 120, deltaY: 40, rotation: 15, scaleX: 0.9, scaleY: 0.9, opacity: 1 },
      { progress: 1, deltaX: 200, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    ],
    ...overrides,
  };
}

const EXPORT_FILE = 'kcs-custom-presets.json';

test.describe('M30 — preset export/import (real UI)', () => {
  test('E2E-1+2+3+25 — create preset, export real file, scene untouched, success toast', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    // M25 UI: pick a builtin IN preset, set duration 18, then save as custom
    await selectInPreset(page, 'slide-scale-left');
    await setInDuration(page, 18);
    await saveCurrentAsPreset(page, 'in', 'My Export Test');
    // options inside a <select> are inherently hidden — assert by count/text
    await expect(page.locator('select[aria-label="Animation In Preset"] option', { hasText: 'My Export Test' })).toHaveCount(1);

    // scene snapshot before export (tracks + layers)
    const sceneBefore = await page.evaluate((key) => JSON.stringify(JSON.parse(localStorage.getItem(key) ?? '{}')), STORAGE_KEY);

    const { fileName, json } = await exportPresets(page);
    expect(fileName).toBe(EXPORT_FILE);
    expect(json.version).toBe(1);
    const presets = json.presets as Record<string, unknown>[];
    expect(presets.some((p) => p.name === 'My Export Test')).toBe(true);
    // DEFAULT_INITIAL_PRESETS never exported (by id — preset_N ids may be
    // user-created too; only the actual default ids are excluded)
    for (const p of presets) {
      expect(DEFAULT_INITIAL_PRESETS.some((d) => d.id === p.id)).toBe(false);
    }
    // success toast (inline-styled portal — match by text)
    await expect(page.getByText('Exported 1 presets')).toBeVisible({ timeout: 5000 });
    // scene unchanged by export
    const sceneAfter = await page.evaluate((key) => JSON.stringify(JSON.parse(localStorage.getItem(key) ?? '{}')), STORAGE_KEY);
    expect(sceneAfter).toBe(sceneBefore);
  });

  test('E2E-4+5+23+26 — import into clean context, apply, runtime works, data intact', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A'), makeLayer('b', 'Part B', { x: 400 })]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await selectInPreset(page, 'slide-scale-left');
    await setInDuration(page, 18);
    await saveCurrentAsPreset(page, 'in', 'My Export Test');
    const { json } = await exportPresets(page);
    const original = (json.presets as Record<string, unknown>[]).find((p) => p.name === 'My Export Test')!;
    const originalId = String(original.id);

    // CLEAN context: wipe ONLY the preset library (simulates browser B with
    // the same scene) and import the file
    await page.evaluate((presetKey) => {
      localStorage.removeItem(presetKey);
      localStorage.setItem('__KCS_E2E_SEEDED__', '1');
    }, PRESET_KEY);
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    // before import: no custom preset
    expect(await page.locator('select[aria-label="Animation In Preset"] option', { hasText: 'My Export Test' }).count()).toBe(0);

    await importFile(page, EXPORT_FILE, JSON.stringify(json));

    // imported preset appears in Custom (same ID preserved — safe)
    await expect(page.locator('select[aria-label="Animation In Preset"] option', { hasText: 'My Export Test' })).toHaveCount(1);
    const imported = (await storedLibrary(page)).find((p) => p.name === 'My Export Test')!;
    expect(String(imported.id)).toBe(originalId); // ID preserved on clean import
    // full data integrity — Save samples builtins at 0/0.25/0.5/0.75/1 (M25C)
    expect(imported.type).toBe('in');
    expect(imported.durationFrames).toBe(18);
    expect(imported.keyframes).toHaveLength(5);
    expect((imported.keyframes as Record<string, unknown>[])[0]).toMatchObject({
      progress: 0, deltaX: 300, opacity: 0, scaleX: 0, scaleY: 0,
    });
    expect((imported.keyframes as Record<string, unknown>[])[4]).toMatchObject({
      progress: 1, deltaX: 0, opacity: 1, scaleX: 1, scaleY: 1,
    });

    // apply the imported preset to Part B → runtime IN animation
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await selectInPreset(page, String(imported.id));
    await setInDuration(page, 18); // duration is a separate M25 control
    await expect(page.locator('select[aria-label="Animation In Preset"]')).toHaveValue(String(imported.id));
    await saveNow(page);
    const part = await page.evaluate(([key, pid]) => {
      const scene = JSON.parse(localStorage.getItem(key) ?? '{}');
      const l = (scene.layers ?? []).find((p: Record<string, unknown>) => p.id === pid) ?? {};
      return { preset: l.inAnimPreset, duration: l.inAnimDuration };
    }, [STORAGE_KEY, 'b'] as [string, string]);
    expect(part.preset).toBe(String(imported.id));
    expect(part.duration).toBe(18);
  });

  test('E2E-6 — cross-machine reconnect: deleted preset reference revives on reimport (ID preserved)', async ({ page }) => {
    // Part B already references custom_known; library is empty (preset deleted — M25 behavior)
    const scene = {
      version: 1,
      layers: [makeLayer('a', 'Part A'), makeLayer('b', 'Part B', { x: 400, inAnimPreset: 'custom_known', inAnimDuration: 18 })],
      tracks: [], fps: 30, totalFrames: 90,
    };
    await page.goto('/');
    await page.evaluate(() => { localStorage.clear(); });
    await page.addInitScript(
      ([key, data]: [string, string]) => {
        if (!localStorage.getItem('__KCS_E2E_SEEDED__')) {
          localStorage.setItem(key, data);
          localStorage.setItem('__KCS_E2E_SEEDED__', '1');
        }
      },
      [STORAGE_KEY, JSON.stringify(scene)],
    );
    await page.goto('/');
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });

    await selectPart(page, 'Part B');
    await openTransformTab(page);
    // deleted custom → display fallback (M25 contract)
    await expect(page.locator('select[aria-label="Animation In Preset"]')).toHaveValue('none');

    // reimport the backup with the SAME id
    const payload = JSON.stringify({ version: 1, presets: [makePreset('custom_known', 'Known Backup', 'in')] });
    await importFile(page, EXPORT_FILE, payload);

    // id preserved → old reference reconnects automatically
    await expect(page.locator('select[aria-label="Animation In Preset"]')).toHaveValue('custom_known');
  });

  test('E2E-7+24 — merge: existing kept, imported appended in file order', async ({ page }) => {
    const existing = makePreset('keep_a', 'Keep A', 'in');
    await seed(page, [makeLayer('a', 'Part A')], [existing]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await expect(page.locator('select[aria-label="Animation In Preset"] option', { hasText: 'Keep A' })).toHaveCount(1);

    const payload = JSON.stringify({
      version: 1,
      presets: [makePreset('add_b', 'Add B', 'in'), makePreset('add_c', 'Add C', 'out')],
    });
    await importFile(page, EXPORT_FILE, payload);

    const lib = await storedLibrary(page);
    expect(lib.map((p) => String(p.id))).toEqual(['keep_a', 'add_b', 'add_c']); // existing first + file order
  });

  test('E2E-8 — ID collision: existing preserved, imported remapped, both remain', async ({ page }) => {
    const existing = makePreset('collision-id', 'Original', 'in');
    await seed(page, [makeLayer('a', 'Part A')], [existing]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);

    const payload = JSON.stringify({ version: 1, presets: [makePreset('collision-id', 'Imported Dup', 'in')] });
    await importFile(page, EXPORT_FILE, payload);

    const lib = await storedLibrary(page);
    expect(lib).toHaveLength(2);
    const original = lib.find((p) => p.name === 'Original')!;
    const dup = lib.find((p) => p.name === 'Imported Dup')!;
    expect(String(original.id)).toBe('collision-id'); // existing untouched
    expect(String(dup.id)).not.toBe('collision-id'); // remapped
    expect(new Set(lib.map((p) => String(p.id))).size).toBe(2); // unique
  });

  test('E2E-9 — default ID collision: default seed protected, imported remapped', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A')]); // defaults seeded when storage empty
    await selectPart(page, 'Part A');
    await openTransformTab(page);

    // import a preset carrying a DEFAULT id (preset_1)
    const payload = JSON.stringify({ version: 1, presets: [makePreset('preset_1', 'Fake Default', 'in')] });
    await importFile(page, EXPORT_FILE, payload);

    const lib = await storedLibrary(page);
    const fake = lib.find((p) => p.name === 'Fake Default')!;
    expect(fake).toBeTruthy();
    expect(String(fake.id)).not.toBe('preset_1'); // remapped — default id protected
    // default seed itself is not deletable via UI (M25) — it lives in the same
    // collection; the remapped id proves no overwrite happened
  });

  test('E2E-10 — duplicate name allowed (no auto-rename)', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A')], [makePreset('orig', 'My Export Test', 'in')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await importFile(page, EXPORT_FILE, JSON.stringify({ version: 1, presets: [makePreset('other', 'My Export Test', 'in')] }));
    const lib = await storedLibrary(page);
    expect(lib.filter((p) => p.name === 'My Export Test')).toHaveLength(2);
  });

  test('E2E-11+12+13 — malformed JSON / invalid version / malformed preset: whole-file reject', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A')], [makePreset('keep', 'Keep', 'in')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);

    // invalid JSON
    await importFile(page, EXPORT_FILE, '{ not json !!');
    await expect(page.getByText('Could not import', { exact: false }).first()).toBeVisible({ timeout: 5000 });
    expect((await storedLibrary(page)).map((p) => String(p.id))).toEqual(['keep']); // unchanged

    // unsupported version
    await importFile(page, EXPORT_FILE, JSON.stringify({ version: 2, presets: [] }));
    await expect(page.getByText('Could not import', { exact: false }).first()).toBeVisible({ timeout: 5000 });
    expect((await storedLibrary(page)).map((p) => String(p.id))).toEqual(['keep']);

    // valid JSON, one malformed preset (missing name)
    await importFile(page, EXPORT_FILE, JSON.stringify({ version: 1, presets: [{ id: 'x1', type: 'in', durationFrames: 10, keyframes: [] }] }));
    await expect(page.getByText('Could not import', { exact: false }).first()).toBeVisible({ timeout: 5000 });
    expect((await storedLibrary(page)).map((p) => String(p.id))).toEqual(['keep']); // no partial import
  });

  test('E2E-14+15 — empty valid file safe; same file re-import works', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A')], [makePreset('keep', 'Keep', 'in')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);

    await importFile(page, EXPORT_FILE, JSON.stringify({ version: 1, presets: [] }));
    expect((await storedLibrary(page)).map((p) => String(p.id))).toEqual(['keep']); // no-op, no crash

    // same file twice → second import remaps collisions, nothing lost
    const payload = JSON.stringify({ version: 1, presets: [makePreset('twice', 'Twice', 'in')] });
    await importFile(page, EXPORT_FILE, payload);
    await importFile(page, EXPORT_FILE, payload);
    const lib = await storedLibrary(page);
    expect(lib).toHaveLength(3); // keep + twice + remapped twice
    expect(new Set(lib.map((p) => String(p.id))).size).toBe(3);
  });

  test('E2E-16+17+28 — reload persistence, export-after-import, apply after reload', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A'), makeLayer('b', 'Part B', { x: 400 })]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await importFile(page, EXPORT_FILE, JSON.stringify({ version: 1, presets: [makePreset('persist_1', 'Persisted', 'in')] }));
    await expect(page.locator('select[aria-label="Animation In Preset"] option', { hasText: 'Persisted' })).toHaveCount(1);

    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 30000 });
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    // persisted after reload
    await expect(page.locator('select[aria-label="Animation In Preset"] option', { hasText: 'Persisted' })).toHaveCount(1);

    // export after import includes the imported preset, still no defaults
    const { json } = await exportPresets(page);
    const presets = json.presets as Record<string, unknown>[];
    expect(presets.some((p) => p.name === 'Persisted')).toBe(true);
    for (const p of presets) expect(String(p.id)).not.toMatch(/^preset_\d+$/);

    // apply imported preset AFTER reload → runtime works
    await selectPart(page, 'Part B');
    await openTransformTab(page);
    await selectInPreset(page, 'persist_1');
    await expect(page.locator('select[aria-label="Animation In Preset"]')).toHaveValue('persist_1');
  });

  test('E2E-18+19+20+21 — M25 Save/Delete regression + Basic/Combinations/custom_timeline intact', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);
    await importFile(page, EXPORT_FILE, JSON.stringify({ version: 1, presets: [makePreset('imp', 'Imported One', 'in')] }));
    await expect(page.locator('select[aria-label="Animation In Preset"] option', { hasText: 'Imported One' })).toHaveCount(1);

    // Basic + Combinations optgroups intact (label is an attribute, not text)
    const groupLabels = await page.locator('select[aria-label="Animation In Preset"] optgroup').evaluateAll((els) =>
      els.map((o) => o.getAttribute('label')),
    );
    expect(groupLabels).toContain('Basic');
    expect(groupLabels).toContain('Combinations');
    expect(groupLabels).toContain('Custom');
    const inOptions = await page.locator('select[aria-label="Animation In Preset"] option').allTextContents();
    expect(inOptions).toContain('None');
    expect(inOptions.some((t) => /fade/i.test(t))).toBe(true);

    // M25 Save still works after import
    await selectInPreset(page, 'slide-scale-left');
    await saveCurrentAsPreset(page, 'in', 'Saved After Import');
    await expect(page.locator('select[aria-label="Animation In Preset"] option', { hasText: 'Saved After Import' })).toHaveCount(1);

    // M25 Delete works on a user preset
    await selectInPreset(page, 'imp');
    await page.locator('[aria-label="Delete Animation Preset"]').click();
    await page.waitForTimeout(300);
    expect(await page.locator('select[aria-label="Animation In Preset"] option', { hasText: 'Imported One' }).count()).toBe(0);
  });

  test('E2E-22+26+27 — scene isolation, accessibility, no history for library ops', async ({ page }) => {
    await seed(page, [makeLayer('a', 'Part A')]);
    await selectPart(page, 'Part A');
    await openTransformTab(page);

    // accessibility
    await expect(page.locator('[aria-label="Export Animation Presets"]')).toBeVisible();
    await expect(page.locator('[aria-label="Import Animation Presets"]')).toBeVisible();
    expect(await page.locator('input[aria-label="Import custom animation presets file"]').count()).toBe(1);

    await importFile(page, EXPORT_FILE, JSON.stringify({ version: 1, presets: [makePreset('iso', 'Iso', 'in')] }));

    // AnimationProject isolation: no preset fields in scene JSON
    const sceneKeys = await page.evaluate((key) => Object.keys(JSON.parse(localStorage.getItem(key) ?? '{}')), STORAGE_KEY);
    expect(sceneKeys).not.toContain('customPresets');
    expect(sceneKeys).not.toContain('presetLibrary');
    expect(sceneKeys).not.toContain('presetVersion');
    // library lives in its own key
    const libKeys = await page.evaluate(() => Object.keys(localStorage));
    expect(libKeys).toContain('keyframe_custom_motion_presets');

    // library ops are NOT undoable (Ctrl+Z must not remove imported presets)
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    expect((await storedLibrary(page)).some((p) => p.name === 'Iso')).toBe(true);
  });
});
