import { expect, test } from '@playwright/test';
import { enterLocalMode, firstGoalStepInput, labels } from './helpers';

test('persists a goal checklist item in local mode', async ({ page }) => {
  await enterLocalMode(page);
  await page.goto('/goals');
  await page.getByRole('button', { name: labels.createGoalGroup }).click();
  await page.waitForURL(/\/goals\?goal=.+/);

  await page.getByRole('button', { name: labels.goalStepEmpty }).click();

  const itemInput = firstGoalStepInput(page);
  await itemInput.fill('Define integration coverage');
  await itemInput.press('Enter');

  await expect(page.locator('[data-goal-step-input="true"]')).toHaveCount(2);
  await expect(
    page.locator('[data-goal-step-input="true"]').nth(1),
  ).toBeFocused();

  const firstCheckbox = page.getByRole('checkbox').first();
  await firstCheckbox.click();
  await expect(firstCheckbox).toBeChecked();

  await page.reload();
  await expect(firstGoalStepInput(page)).toHaveValue(
    'Define integration coverage',
  );

  await page.goBack();
  await expect(
    page.getByRole('button', { name: labels.newGoalGroup }),
  ).toBeVisible();
});
