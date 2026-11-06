import { expect, test, type Locator, type Page } from '@playwright/test';
import { enterLocalMode, labels } from './helpers';

const recurringLabels = {
  activities: /^(activities|atividades)$/i,
  addFirstChild: /no subtasks|sem subtarefas/i,
  applyForward: /only from now on|somente daqui em diante/i,
  chooseDate: /^(choose date|escolher data)$/i,
  confirm: /^(confirm|confirmar)$/i,
  dayView: /^(day view|visão do dia)$/i,
  nextDay: /^(next day|próximo dia)$/i,
  newActivity: /^(new activity|nova atividade)$/i,
  nameLabel: /^(activity name|nome da atividade)$/i,
  noData: /^(no data|sem dados)$/i,
  openDailyTasks: /^(open daily tasks|abrir tarefas do dia)$/i,
  previousDay: /^(previous day|dia anterior)$/i,
  save: /^(save|salvar)$/i,
  today: /^(today|hoje)$/i,
};

function answerButton(
  scope: Locator,
  status: 'done' | 'not_done',
  name: string,
) {
  const label = status === 'done' ? '(Done|Feito)' : '(Not done|Não feito)';

  return scope.getByRole('button', {
    name: new RegExp(`^${label}: ${name}$`, 'i'),
  });
}

function actionButton(page: Page, action: RegExp, name: string) {
  return page
    .getByRole('region', { name: recurringLabels.activities })
    .getByRole('button', {
      name: new RegExp(`^${action.source}: ${name}$`, 'i'),
    });
}

async function openRecurring(page: Page) {
  await enterLocalMode(page);
  await page.getByRole('link', { name: labels.recurringLink }).click();
  await page.waitForURL('**/recurring');
}

async function createDailyActivity(page: Page, name: string) {
  await page.getByRole('button', { name: recurringLabels.newActivity }).click();

  const dialog = page.getByRole('dialog');

  await dialog.getByLabel(recurringLabels.nameLabel).fill(name);
  await dialog.getByRole('button', { name: recurringLabels.save }).click();
  await expect(dialog).toBeHidden();
}

test('answers a daily activity and keeps it after a reload', async ({
  page,
}) => {
  await openRecurring(page);
  await createDailyActivity(page, 'Stretch');

  const day = page.getByRole('region', { name: recurringLabels.dayView });
  const overview = page.getByRole('region', {
    name: recurringLabels.activities,
  });

  await expect(overview.getByText(recurringLabels.noData)).toBeVisible();

  const done = answerButton(day, 'done', 'Stretch');

  await done.click();
  await expect(done).toHaveAttribute('aria-pressed', 'true');
  await expect(overview.getByText(/100%/)).toBeVisible();

  await page.reload();
  await expect(answerButton(day, 'done', 'Stretch')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await answerButton(day, 'done', 'Stretch').click();
  await expect(overview.getByText(recurringLabels.noData)).toBeVisible();
});

test('navigates by day and only applies a picked date after confirming', async ({
  page,
}) => {
  await openRecurring(page);
  await createDailyActivity(page, 'Stretch');

  const day = page.getByRole('region', { name: recurringLabels.dayView });
  const dateLabel = day.locator('p[aria-live="polite"]');
  const todayLabel = await dateLabel.innerText();

  await day.getByRole('button', { name: recurringLabels.previousDay }).click();
  await expect(dateLabel).not.toHaveText(todayLabel);

  await day.getByRole('button', { name: recurringLabels.today }).click();
  await expect(dateLabel).toHaveText(todayLabel);

  await day.getByRole('button', { name: recurringLabels.nextDay }).click();
  await expect(answerButton(day, 'done', 'Stretch')).toBeDisabled();
  await day.getByRole('button', { name: recurringLabels.today }).click();

  await day.getByRole('button', { name: recurringLabels.chooseDate }).click();

  const picker = page.getByRole('dialog');
  const nextMonthDay = picker.getByRole('button', { pressed: false }).filter({
    hasText: /^15$/,
  });

  await nextMonthDay.first().click();
  await expect(dateLabel).toHaveText(todayLabel);

  await picker.getByRole('button', { name: recurringLabels.confirm }).click();
  await expect(picker).toBeHidden();
  await expect(dateLabel).toContainText('15');
});

test('opens the daily tasks of the selected date and returns to it', async ({
  page,
}) => {
  await openRecurring(page);

  const day = page.getByRole('region', { name: recurringLabels.dayView });
  const dateLabel = day.locator('p[aria-live="polite"]');

  await day.getByRole('button', { name: recurringLabels.previousDay }).click();

  const selectedLabel = await dateLabel.innerText();

  await page
    .getByRole('link', { name: recurringLabels.openDailyTasks })
    .click();
  await page.waitForURL(/\/calendar\?day=\d{4}-\d{2}-\d{2}/);

  await page.getByRole('button', { name: labels.backToCalendar }).click();
  await page.waitForURL(/\/recurring\?date=\d{4}-\d{2}-\d{2}/);
  await expect(dateLabel).toHaveText(selectedLabel);
});

test('asks how to apply a content change after answers exist', async ({
  page,
}) => {
  await openRecurring(page);
  await createDailyActivity(page, 'Stretch');

  const day = page.getByRole('region', { name: recurringLabels.dayView });

  await answerButton(day, 'done', 'Stretch').click();
  await expect(answerButton(day, 'done', 'Stretch')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await actionButton(page, /(Edit|Editar)/, 'Stretch').click();

  const editor = page.getByRole('dialog');

  await editor.getByLabel(recurringLabels.nameLabel).fill('Long stretch');
  await editor.getByRole('button', { name: recurringLabels.save }).click();
  await page
    .getByRole('button', { name: recurringLabels.applyForward })
    .click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await expect(answerButton(day, 'done', 'Stretch')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await day.getByRole('button', { name: recurringLabels.nextDay }).click();
  await expect(answerButton(day, 'done', 'Long stretch')).toBeVisible();
});

test('pauses, reactivates and deletes an activity', async ({ page }) => {
  await openRecurring(page);
  await createDailyActivity(page, 'Stretch');

  const day = page.getByRole('region', { name: recurringLabels.dayView });

  await actionButton(page, /(Pause|Pausar)/, 'Stretch').click();
  await expect(answerButton(day, 'done', 'Stretch')).toBeHidden();

  await actionButton(page, /(Reactivate|Reativar)/, 'Stretch').click();
  await expect(answerButton(day, 'done', 'Stretch')).toBeVisible();

  await actionButton(page, /(Delete|Excluir)/, 'Stretch').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(delete|excluir)$/i })
    .click();

  await expect(answerButton(day, 'done', 'Stretch')).toBeHidden();
  await expect(
    page
      .getByRole('region', { name: recurringLabels.activities })
      .getByText('Stretch'),
  ).toBeHidden();
});

test('adds a subtask that is answered on its own', async ({ page }) => {
  await openRecurring(page);
  await page.getByRole('button', { name: recurringLabels.newActivity }).click();

  const dialog = page.getByRole('dialog');

  await dialog.getByLabel(recurringLabels.nameLabel).fill('Routine');
  await dialog
    .getByRole('button', { name: recurringLabels.addFirstChild })
    .click();
  await dialog.locator('[data-recurrence-child-input="true"]').fill('Warm up');
  await dialog.getByRole('button', { name: recurringLabels.save }).click();
  await expect(dialog).toBeHidden();

  const day = page.getByRole('region', { name: recurringLabels.dayView });
  const childDone = answerButton(day, 'done', 'Warm up');

  await childDone.click();
  await expect(childDone).toHaveAttribute('aria-pressed', 'true');
  await expect(answerButton(day, 'done', 'Routine')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(
    page
      .getByRole('region', { name: recurringLabels.activities })
      .getByText(recurringLabels.noData),
  ).toBeVisible();
});

test('keeps the actions inside the card with a long activity name', async ({
  page,
}) => {
  const longName = 'Routine with a very long name '.repeat(6).trim();

  await openRecurring(page);
  await createDailyActivity(page, longName);

  const overview = page.getByRole('region', {
    name: recurringLabels.activities,
  });
  const card = overview.getByRole('listitem');
  const remove = card.getByRole('button', { name: /^(delete|excluir): /i });

  await expect(remove).toBeVisible();

  const cardBox = await card.boundingBox();
  const removeBox = await remove.boundingBox();

  expect(removeBox!.x + removeBox!.width).toBeLessThanOrEqual(
    cardBox!.x + cardBox!.width,
  );

  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );

  expect(hasOverflow).toBe(false);
});

test('manages categories from the editor without losing the draft', async ({
  page,
}) => {
  await openRecurring(page);
  await page.getByRole('button', { name: recurringLabels.newActivity }).click();

  const editor = page.getByRole('dialog');

  await editor.getByLabel(recurringLabels.nameLabel).fill('Draft name');
  await editor.getByRole('button', { name: labels.categories }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: /^(cancel|cancelar)$/i })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(editor.getByLabel(recurringLabels.nameLabel)).toHaveValue(
    'Draft name',
  );
});
