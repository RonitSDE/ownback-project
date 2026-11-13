import { test, expect } from '@playwright/test';
test('judges can run purchase-to-comeback journey and inspect proof', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByText('Every checkout is a chance to')).toBeVisible();
  await page.getByRole('button', { name: /Run judge journey/ }).click();
  await expect(page.getByText('demo-order-002')).toBeVisible();
  await expect(page.getByText('$2.40').first()).toBeVisible();
  await expect(page.getByText('Mock stock delivered')).toBeVisible();
  await page.getByRole('button', { name: /Activity Ledger/ }).click();
  await expect(page.getByText('demo-order-001')).toBeVisible();
});
test('duplicate rewards are visibly blocked', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: /Run judge journey/ }).click();
  await page.getByRole('button', { name: /Replay same order ID/ }).click();
  await page.getByRole('button', { name: /Run simulation & inspect result/ }).click();
  await expect(page.getByText('POLICY BLOCKED')).toBeVisible();
  await expect(page.getByText('Duplicate order identifier').first()).toBeVisible();
});
test('customer wallet uses internally consistent mock token amounts', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: /Run judge journey/ }).click();
  await page.getByRole('button', { name: /Customer Wallet/ }).click();
  await expect(page.getByText('0.016800 mB20')).toBeVisible();
  await expect(page.getByText('$3.36').first()).toBeVisible();
});

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
