import { expect, type Locator, type Page } from '@playwright/test';

export const labels = {
  calendarLink: /daily calendar|calendario diario|calendário diário/i,
  goalStepEmpty:
    /start this section with a checklist item|comece esta seção com um item de checklist/i,
  goalsLink: /^goals$|^metas$/i,
  localModeBadge: /local mode|modo local/i,
  localModeButton: /use local mode|usar em modo local/i,
  checklistEmpty:
    /start this day with a checklist item|comece este dia com um item de checklist/i,
};

export async function enterLocalMode(page: Page) {
  await page.goto('/');
  const localModeBadge = page.getByText(labels.localModeBadge).first();
  const localModeButton = page.getByText(labels.localModeButton).first();

  await Promise.race([
    localModeBadge.waitFor({ state: 'visible' }),
    localModeButton.waitFor({ state: 'visible' }),
  ]);

  if (await localModeButton.isVisible()) {
    await localModeButton.click();
  }

  await expect(localModeBadge).toBeVisible();
}

export function firstChecklistInput(parent: Page | Locator) {
  return parent.locator('[data-checklist-input="true"]').first();
}

export function firstGoalStepInput(parent: Page | Locator) {
  return parent.locator('[data-goal-step-input="true"]').first();
}
