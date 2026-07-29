import { expect, type Locator, type Page } from '@playwright/test';

export const labels = {
  calendarLink: /daily tasks|tarefas do dia/i,
  goalStepEmpty:
    /start this goal by adding a step|comece esta meta adicionando uma etapa/i,
  createGoal: /^new goal$|^nova meta$/i,
  goalsLink: /^goals$|^metas$/i,
  localModeBadge: /local mode|modo local/i,
  localModeButton:
    /continue without syncing|continuar sem sincronizar|use local mode|usar em modo local/i,
  checklistEmpty: /start this day with a task|comece este dia com uma tarefa/i,
  backToCalendar: /back to calendar|voltar para o calendário/i,
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

  await page.waitForURL('**/calendar**');
  await expect(localModeBadge).toBeVisible();
}

export function firstChecklistInput(parent: Page | Locator) {
  return parent.locator('[data-checklist-input="true"]').first();
}

export function firstGoalStepInput(parent: Page | Locator) {
  return parent.locator('[data-goal-step-input="true"]').first();
}
