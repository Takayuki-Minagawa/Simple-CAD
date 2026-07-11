import { expect, test } from '@playwright/test';

test('reloads the production app offline after service-worker installation', async ({
  context,
  page,
}) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        });
      });
    }
  });
  await page.reload();
  await expect(page.getByText('Structural Web CAD')).toBeVisible();
  const workerState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      scriptUrl: registration.active?.scriptURL ?? '',
      cacheKeys: await caches.keys(),
    };
  });
  expect(new URL(workerState.scriptUrl).searchParams.get('v')).toBeTruthy();
  expect(workerState.cacheKeys.some((key) => key.startsWith('simple-cad-runtime-'))).toBe(true);

  await page.getByRole('button', { name: 'ファイル' }).click();
  await page.getByRole('menuitem', { name: 'サンプル' }).click();
  await expect(page.getByRole('combobox', { name: '階' })).toHaveValue('1F');

  await context.setOffline(true);
  try {
    // The viewer is a lazy chunk and has not been requested by the page yet.
    // It must still be available from the install-time asset precache.
    await page.getByRole('button', { name: '表示', exact: true }).click();
    await page.getByRole('menuitemradio', { name: '3D' }).click();
    await expect(page.locator('canvas')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Structural Web CAD')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
