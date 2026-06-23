// e2e/tests/app.spec.js
const { test, expect } = require('@playwright/test');

const timestamp = Date.now();
const TEST_EMAIL_REGISTER = `testuser_register_${timestamp}@example.com`;
const TEST_EMAIL_LOGIN    = `testuser_login_${timestamp}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Playwright User';

// ── 1. Landing page ───────────────────────────────────────────────────────────

test('landing page loads and shows key elements', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Qualif/i);
  await expect(page.getByRole('button', { name: /try demo — no signup/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /try free/i })).toBeVisible();
});

// ── 2. Register ───────────────────────────────────────────────────────────────

test('user can register a new account', async ({ page }) => {
  await page.goto('/register');

  await page.locator('input[name="name"]').fill(TEST_NAME);
  await page.locator('input[name="email"]').fill(TEST_EMAIL_REGISTER);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /create free account/i }).click();

  await expect(page).toHaveURL(/\/app/i, { timeout: 10000 });
});

// ── 3. Login ──────────────────────────────────────────────────────────────────

test('user can log in with registered credentials', async ({ page }) => {
  // Register a fresh account (different email from test 2)
  await page.goto('/register');
  await page.locator('input[name="name"]').fill(TEST_NAME);
  await page.locator('input[name="email"]').fill(TEST_EMAIL_LOGIN);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /create free account/i }).click();
  await page.waitForURL(/\/app/i, { timeout: 10000 });

  // Clear auth and go to login
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');

  await page.locator('input[name="email"]').fill(TEST_EMAIL_LOGIN);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  await expect(page).toHaveURL(/\/app/i, { timeout: 10000 });
});

// ── 4. Guest demo mode ────────────────────────────────────────────────────────

test('guest demo mode starts without login', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /try demo — no signup/i }).click();

  await expect(page).toHaveURL(/\/app/i, { timeout: 10000 });
});