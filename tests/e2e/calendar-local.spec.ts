import { expect, test } from '@playwright/test';
import {
  enterLocalMode,
  firstChecklistInput,
  labels,
  openCalendarBulkCreate,
  openCategoryManager,
  openMonthGrid,
} from './helpers';

test('persists a daily task in local mode', async ({ page, isMobile }) => {
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
  await page.waitForURL(/\/calendar$/);
  await openMonthGrid(page, Boolean(isMobile));
  await expect(page.locator('.calendar-day-cell')).toHaveCount(42);

  await page.goBack();
  await expect(firstChecklistInput(page)).toHaveValue(
    'Review architecture plan',
  );
});

test('picks a marking level from the checkbox context menu', async ({
  page,
}) => {
  await enterLocalMode(page);
  await page.goto('/calendar?day=2026-05-22');
  await page.getByRole('button', { name: labels.checklistEmpty }).click();

  const itemInput = firstChecklistInput(page);
  await itemInput.fill('Spaced repetition');
  await itemInput.press('Enter');

  await page
    .getByRole('button', { name: labels.configureTaskPreferences })
    .click();
  await page.getByRole('radio', { name: labels.markingLevelsThree }).click();
  await page.getByRole('button', { name: labels.closeDialog }).first().click();

  const checkbox = page.getByRole('checkbox').first();
  await checkbox.click({ button: 'right' });
  await page
    .getByRole('menuitemradio', { name: labels.markingLevelTwoOfThree })
    .click();

  await expect(checkbox).toHaveAttribute('data-mark-level', '2');

  await page.reload();
  await expect(page.getByRole('checkbox').first()).toHaveAttribute(
    'data-mark-level',
    '2',
  );
});

test('fits the month calendar in the viewport without page scroll on desktop', async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), 'the month grid is a sheet on touch');

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

test('uses the shared date picker in calendar forms', async ({
  page,
  isMobile,
}) => {
  await enterLocalMode(page);
  await openCalendarBulkCreate(page, Boolean(isMobile));

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

test('shows modal feedback as a toast notification', async ({
  page,
  isMobile,
}) => {
  await enterLocalMode(page);
  await openCalendarBulkCreate(page, Boolean(isMobile));

  await page.getByRole('button', { name: /^create$|^criar$/i }).click();

  await expect(
    page.getByRole('alert').filter({
      hasText:
        /start and end dates are required|data inicial e data final são obrigatórias/i,
    }),
  ).toBeVisible();
});

test('saves a category name even when its modal closes before blur', async ({
  page,
  isMobile,
}) => {
  await enterLocalMode(page);
  await openCategoryManager(page, Boolean(isMobile));

  const categoryName = page
    .getByRole('textbox', { name: /category name|nome da categoria/i })
    .first();

  await categoryName.fill('FOCO IMEDIATO');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await openCategoryManager(page, Boolean(isMobile));
  await expect(
    page
      .getByRole('textbox', { name: /category name|nome da categoria/i })
      .first(),
  ).toHaveValue('FOCO IMEDIATO');
});

test('keeps the task text sharing the row on the pointer composition', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'covers the desktop composition only');

  await enterLocalMode(page);
  await page.goto('/calendar?day=2026-05-21');
  await page.getByRole('button', { name: labels.checklistEmpty }).click();

  const input = firstChecklistInput(page);
  await input.fill('Equilibrio quimico com um titulo bastante longo');

  const row = page.locator('[data-tree-row]').first();
  const field = row.locator('[data-task-text-field]').first();
  const rowBox = await row.boundingBox();
  const fieldBox = await field.boundingBox();

  expect(rowBox).not.toBeNull();
  expect(fieldBox).not.toBeNull();
  expect(fieldBox!.width).toBeLessThan(rowBox!.width * 0.85);
});
