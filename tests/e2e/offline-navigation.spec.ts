import { expect, test } from '@playwright/test';
import { enterLocalMode, labels } from './helpers';

test('reloads the functional app shell while offline', async ({
  context,
  page,
}) => {
  await enterLocalMode(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole('link', { name: labels.goalsLink }).click();
  await page.waitForURL('**/goals');
  await page.getByRole('button', { name: labels.createGoal }).click();
  await page.waitForURL(/\/goals\?goal=.+/);
  const goalTitle = page.getByRole('textbox', {
    name: /rename goal|renomear meta/i,
  });
  await goalTitle.fill('Offline goal');
  await goalTitle.press('Tab');
  await page.waitForTimeout(250);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('textbox', { name: /rename goal|renomear meta/i }),
  ).toHaveValue('OFFLINE GOAL');

  await page.goto('/calendar?day=2026-05-23');
  await expect(
    page.getByRole('button', { name: labels.backToCalendar }),
  ).toBeVisible();
});
