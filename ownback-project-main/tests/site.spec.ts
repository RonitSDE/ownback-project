import { test, expect } from '@playwright/test';
test('landing page leads with the product, not a promise of ownership', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Turn a first purchase/ })).toBeVisible();
  await expect(page.getByText(/mock\/testnet stock has no equity rights/).first()).toBeVisible();
});

test('shop and merchant pages render and read the configured chain', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.getByText('Pay in USDC. Get paid back in stock.')).toBeVisible();
  await page.goto('/merchant');
  await expect(page.getByText('Your stock-back campaign')).toBeVisible();
});
