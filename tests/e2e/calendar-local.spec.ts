import { expect, test } from '@playwright/test';
import { enterLocalMode, firstChecklistInput, labels } from './helpers';

test('persists a day checklist item in local mode', async ({ page }) => {
  await enterLocalMode(page);
  await page.goto('/calendar?day=2026-05-21');

  const dayEditor = page.getByRole('dialog');
  await expect(dayEditor).toBeVisible();
  await dayEditor.getByRole('button', { name: labels.checklistEmpty }).click();

  const itemInput = firstChecklistInput(dayEditor);
  await itemInput.fill('Review architecture plan');
  await itemInput.press('Enter');

  await expect(dayEditor.locator('[data-checklist-input="true"]')).toHaveCount(
    2,
  );
  await expect(
    dayEditor.locator('[data-checklist-input="true"]').nth(1),
  ).toBeFocused();

  const firstCheckbox = dayEditor.getByRole('checkbox').first();
  await firstCheckbox.click();
  await expect(firstCheckbox).toBeChecked();

  await page.reload();
  await expect(firstChecklistInput(page.getByRole('dialog'))).toHaveValue(
    'Review architecture plan',
  );
});
