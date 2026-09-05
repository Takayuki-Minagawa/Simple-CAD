import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('loads the editor and opens the sample project', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Structural Web CAD')).toBeVisible();

  await page.getByRole('button', { name: 'ファイル' }).click();
  await page.getByRole('menuitem', { name: 'サンプル' }).click();
  await expect(page.getByRole('combobox', { name: '階' })).toHaveValue('1F');
});

test('main screen has no serious accessibility violations', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'ファイル' }).click();
  await page.getByRole('menuitem', { name: 'サンプル' }).click();
  await expect(page.getByRole('combobox', { name: '階' })).toHaveValue('1F');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

  expect(
    results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    ),
  ).toEqual([]);
});

test('exports DXF in legacy and modern versions for the selected story', async ({ page }) => {
  // Exercise the download fallback without opening an OS save dialog.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('./');
  await page.getByRole('button', { name: 'ファイル' }).click();
  await page.getByRole('menuitem', { name: 'サンプル' }).click();
  for (const [version, story] of [
    ['AC1015', '1F'],
    ['AC1027', '1F'],
    ['AC1032', '1F'],
    ['AC1032', '2F'],
  ]) {
    await page.getByRole('button', { name: 'ファイル' }).click();
    await page.getByRole('menuitem', { name: '出力' }).click();
    await page.getByLabel('形式', { exact: true }).selectOption('dxf');
    await page.getByLabel('DXFバージョン').selectOption(version);
    await page.getByLabel('出力する階').selectOption(story);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'エクスポート', exact: true }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const dxf = Buffer.concat(chunks).toString('utf8');
    expect(dxf).toContain(`$ACADVER\n1\n${version}\n`);
    if (story === '1F') expect(dxf).toContain('C-X1Y1-1F');
    else expect(dxf).not.toContain('SIMPLECAD_MEMBER:'); // The sample's 2F is empty.
  }
});
