import { expect, test } from '@playwright/test';
import { enterLocalMode, firstChecklistInput, labels } from './helpers';

test('persists a daily task in local mode', async ({ page }) => {
  await enterLocalMode(page);
  await page.goto('/calendar?day=2026-05-21');

  const backButton = page.getByRole('button', { name: labels.backToCalendar });
  await expect(backButton).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: labels.checklistEmpty }).click();

  const itemInput = firstChecklistInput(page);
  await itemInput.fill('Review architecture plan');
  await itemInput.press('Enter');

  await expect(page.locator('[data-checklist-input="true"]')).toHaveCount(2);
  await expect(
    page.locator('[data-checklist-input="true"]').nth(1),
  ).toBeFocused();

  const firstCheckbox = page.getByRole('checkbox').first();
  await firstCheckbox.click();
  await expect(firstCheckbox).toBeChecked();

  await page.reload();
  await expect(firstChecklistInput(page)).toHaveValue(
    'Review architecture plan',
  );

  await backButton.click();
  await expect(page.locator('.calendar-day-cell')).toHaveCount(42);

  await page.goBack();
  await expect(firstChecklistInput(page)).toHaveValue(
    'Review architecture plan',
  );
});

test('fits the month calendar in the viewport without page scroll on desktop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await enterLocalMode(page);
  await page.goto('/calendar');

  await expect(page.locator('.calendar-day-cell')).toHaveCount(42);

  const hasPageScroll = await page.evaluate(
    () =>
      document.documentElement.scrollHeight >
      document.documentElement.clientHeight,
  );

  expect(hasPageScroll).toBe(false);
});

test('uses the shared date picker in calendar forms', async ({ page }) => {
  await enterLocalMode(page);
  await page
    .getByRole('button', { name: /create in bulk|criar em lote/i })
    .click();

  const startDateInput = page.getByRole('textbox', {
    name: /start date|data inicial/i,
  });
  await startDateInput.fill('15072026');
  await expect(startDateInput).toHaveValue('15-07-2026');

  await page
    .getByRole('button', {
      name: /open date picker for start date|abrir seletor de data para data inicial/i,
    })
    .click();

  await expect(
    page.getByRole('dialog', { name: /select date|selecionar data/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'July 15, 2026' }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'July 20, 2026' }).click();
  await expect(startDateInput).toHaveValue('20-07-2026');
});
