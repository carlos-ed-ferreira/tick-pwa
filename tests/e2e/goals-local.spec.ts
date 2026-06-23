import { expect, test } from '@playwright/test';
import { enterLocalMode, firstGoalStepInput, labels } from './helpers';

test('persists a goal checklist item in local mode', async ({ page }) => {
  await enterLocalMode(page);
  await page.goto('/goals');
  await page.getByRole('button', { name: labels.createGoal }).click();
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
    page.getByRole('button', { name: labels.createGoal }).first(),
  ).toBeVisible();
});

test('caps a long goal title without deforming the back button or overflowing the page', async ({
  page,
}) => {
  await enterLocalMode(page);
  await page.goto('/goals');
  await page.getByRole('button', { name: labels.createGoal }).click();
  await page.waitForURL(/\/goals\?goal=.+/);

  const backButton = page.getByRole('button', {
    name: /back to goal groups|voltar para grupos de metas/i,
  });
  const initialButtonBox = await backButton.boundingBox();

  await page
    .getByRole('textbox', { name: /rename goal|renomear meta/i })
    .fill('X'.repeat(300));

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  const finalButtonBox = await backButton.boundingBox();

  expect(overflow).toBe(0);
  expect(initialButtonBox).not.toBeNull();
  expect(finalButtonBox).not.toBeNull();
  expect(finalButtonBox?.width).toBeCloseTo(initialButtonBox?.width ?? 0, 0);
  expect(finalButtonBox?.height).toBeCloseTo(initialButtonBox?.height ?? 0, 0);
});
