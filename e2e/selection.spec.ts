import { expect, test, type Page } from '@playwright/test';

async function openSample(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'ファイル' }).click();
  await page.getByRole('menuitem', { name: 'サンプル' }).click();
  await expect(page.getByRole('combobox', { name: '階' })).toHaveValue('1F');
}

test('filters objects, selects matches, and respects locked and hidden layers', async ({ page }) => {
  await openSample(page);
  const objects = page.locator('.left-panel');
  const search = objects.getByRole('searchbox', { name: 'オブジェクト検索' });
  const type = objects.getByRole('combobox', { name: 'オブジェクト種別' });
  const selectMatches = objects.getByRole('button', { name: '該当項目を選択' });
  await type.selectOption('column');
  await search.fill('x1');
  const rows = objects.locator('button.tree-node');
  await expect(rows).toHaveCount(2);
  await selectMatches.click();
  await expect(objects.locator('button.tree-node[aria-pressed="true"]')).toHaveCount(2);

  await rows.first().click({ modifiers: ['Shift'] });
  await expect(objects.locator('button.tree-node[aria-pressed="true"]')).toHaveCount(1);
  await rows.first().focus();
  await page.keyboard.press('Shift+Space');
  await expect(objects.locator('button.tree-node[aria-pressed="true"]')).toHaveCount(2);

  const columnLayer = objects.locator('.layer-row').filter({ has: page.getByRole('checkbox', { name: '柱', exact: true }) });
  await columnLayer.getByTitle('Lock', { exact: true }).click();
  await expect(rows.first()).toBeDisabled();
  await expect(selectMatches).toBeDisabled();
  await expect(objects.locator('button.tree-node[aria-pressed="true"]')).toHaveCount(0);
  await columnLayer.getByTitle('Unlock', { exact: true }).click();
  await columnLayer.getByRole('checkbox', { name: '柱', exact: true }).uncheck();
  await expect(selectMatches).toBeDisabled();
  await columnLayer.getByRole('checkbox', { name: '柱', exact: true }).check();
  await expect(selectMatches).toBeEnabled();

  await page.getByRole('combobox', { name: '階', exact: true }).selectOption('2F');
  await expect(rows).toHaveCount(0);
  await expect(selectMatches).toBeDisabled();
  await page.getByRole('combobox', { name: '階', exact: true }).selectOption('1F');
  await objects.getByRole('button', { name: '条件クリア' }).click();
  await expect(search).toHaveValue('');
  await expect(type).toHaveValue('all');
});

test('rectangle selection survives the browser click after mouseup', async ({ page }) => {
  await openSample(page);
  await page.keyboard.press('z');
  const canvas = page.locator('.center-canvas svg').first();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const { x, y, width, height } = bounds!;
  // Start below the floating toolbar, in the empty margin around the model.
  await page.mouse.move(x + 4, y + height - 4);
  await page.mouse.down();
  await page.mouse.move(x + width - 4, y + 4, { steps: 8 });
  await page.mouse.up();

  const selectionCount = page.locator('.status-item').filter({ hasText: /^選択: / });
  await expect(selectionCount).toHaveText(/^選択: [1-9]\d*$/);
  const selected = await selectionCount.innerText();

  // A modified empty click preserves the selection; the next ordinary click clears it.
  await page.keyboard.down('Shift');
  await canvas.click({ position: { x: 4, y: height - 4 } });
  await page.keyboard.up('Shift');
  await expect(selectionCount).toHaveText(selected);
  await canvas.click({ position: { x: 4, y: height - 4 } });
  await expect(selectionCount).toHaveText('選択: 0');
});
