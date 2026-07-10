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
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(
    results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    ),
  ).toEqual([]);
});
