import { expect, test } from '@playwright/test';
import { enterLocalMode, firstGoalStepInput, labels } from './helpers';

test('persists a goal checklist item in local mode', async ({ page }) => {
  await enterLocalMode(page);
  await page.goto('/goals');

  const shortTermSection = page.getByLabel('Short term');
  await shortTermSection
    .getByRole('button', { name: labels.goalStepEmpty })
    .click();

  const itemInput = firstGoalStepInput(shortTermSection);
  await itemInput.fill('Define integration coverage');
  await itemInput.press('Enter');

  await expect(
    shortTermSection.locator('[data-goal-step-input="true"]'),
  ).toHaveCount(2);

  await page.reload();
  await expect(firstGoalStepInput(page.getByLabel('Short term'))).toHaveValue(
    'Define integration coverage',
  );
});
