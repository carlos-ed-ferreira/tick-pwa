import { expect, test, type Locator, type Page } from '@playwright/test';
import { enterLocalMode, labels } from './helpers';

const recurringLabels = {
  activities: /^(activities|atividades)$/i,
  execute: /^(execute|executar)$/i,
  manage: /^(manage|gerenciar)$/i,
  addFirstChild: /no subtasks|sem subtarefas/i,
  applyForward: /only from now on|somente daqui em diante/i,
  chooseDate: /^(choose another date|escolher outra data)$/i,
  dayView: /^(day view|visão do dia)$/i,
  nextDay: /^(next day|próximo dia)$/i,
  newActivity:
    /^(new activity|nova atividade|start by creating a recurring activity|comece criando uma atividade recorrente)$/i,
  nameLabel: /^(activity name|nome da atividade)$/i,
  noData: /^(no data|sem dados)$/i,
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

async function showView(page: Page, view: RegExp) {
  await page.getByRole('button', { name: view }).click();
}

async function chooseAction(page: Page, action: RegExp, name: string) {
  await showView(page, recurringLabels.manage);
  await page
    .getByRole('button', {
      name: new RegExp(`^(more actions|mais ações): ${name}`, 'i'),
    })
    .click();
  await page
    .getByRole('menuitem', { name: action })
    .or(page.getByRole('dialog').getByRole('button', { name: action }))
    .click();
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

  await showView(page, recurringLabels.manage);
  await expect(overview.getByText(recurringLabels.noData)).toBeVisible();
  await showView(page, recurringLabels.execute);

  const done = answerButton(day, 'done', 'Stretch');

  await done.click();
  await expect(done).toHaveAttribute('aria-pressed', 'true');
  await showView(page, recurringLabels.manage);
  await expect(overview.getByText(/100%/)).toBeVisible();

  await page.reload();
  await expect(answerButton(day, 'done', 'Stretch')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await answerButton(day, 'done', 'Stretch').click();
  await showView(page, recurringLabels.manage);
  await expect(overview.getByText(recurringLabels.noData)).toBeVisible();
});

test('navigates by day and applies a picked date at once', async ({ page }) => {
  await openRecurring(page);
  await createDailyActivity(page, 'Stretch');

  const day = page.getByRole('region', { name: recurringLabels.dayView });
  const dateLabel = day.locator('p[aria-live="polite"]');
  const todayLabel = await dateLabel.innerText();

  await day.getByRole('button', { name: recurringLabels.previousDay }).click();
  await expect(dateLabel).not.toHaveText(todayLabel);

  await day.getByRole('button', { name: recurringLabels.chooseDate }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: recurringLabels.today })
    .click();
  await expect(dateLabel).toHaveText(todayLabel);

  await day.getByRole('button', { name: recurringLabels.nextDay }).click();
  await expect(answerButton(day, 'done', 'Stretch')).toBeDisabled();
  await day.getByRole('button', { name: recurringLabels.chooseDate }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: recurringLabels.today })
    .click();

  await day.getByRole('button', { name: recurringLabels.chooseDate }).click();

  const picker = page.getByRole('dialog');
  const nextMonthDay = picker.getByRole('button', { pressed: false }).filter({
    hasText: /^15$/,
  });

  await nextMonthDay.first().click();
  await expect(picker).toBeHidden();
  await expect(dateLabel).toContainText('15');
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

  await chooseAction(page, /^(edit activity|editar atividade)$/i, 'Stretch');

  const editor = page.getByRole('dialog');

  await editor.getByLabel(recurringLabels.nameLabel).fill('Long stretch');
  await editor.getByRole('button', { name: recurringLabels.save }).click();
  await page
    .getByRole('button', { name: recurringLabels.applyForward })
    .click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await showView(page, recurringLabels.execute);
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

  await chooseAction(page, /^(pause|pausar)$/i, 'Stretch');
  await showView(page, recurringLabels.execute);
  await expect(answerButton(day, 'done', 'Stretch')).toBeHidden();

  await chooseAction(page, /^(reactivate|reativar)$/i, 'Stretch');
  await showView(page, recurringLabels.execute);
  await expect(answerButton(day, 'done', 'Stretch')).toBeVisible();

  await chooseAction(page, /^(delete activity|excluir atividade)$/i, 'Stretch');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(delete|excluir)$/i })
    .click();

  await expect(
    page.getByRole('button', {
      name: /start by creating a recurring activity|comece criando uma atividade recorrente/i,
    }),
  ).toBeVisible();
  await expect(page.getByText('Stretch')).toHaveCount(0);
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
  await showView(page, recurringLabels.manage);
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

  const hasOverflow = () =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

  const answer = answerButton(
    page.getByRole('region', { name: recurringLabels.dayView }),
    'not_done',
    longName,
  );
  const row = answer.locator('xpath=ancestor::*[@data-tree-row][1]');
  const answerBox = await answer.boundingBox();
  const rowBox = await row.boundingBox();

  expect(answerBox!.x + answerBox!.width).toBeLessThanOrEqual(
    rowBox!.x + rowBox!.width,
  );
  expect(await hasOverflow()).toBe(false);

  await showView(page, recurringLabels.manage);

  const overview = page.getByRole('region', {
    name: recurringLabels.activities,
  });
  const card = overview.getByRole('listitem');
  const menu = card.getByRole('button', {
    name: /^(more actions|mais ações): /i,
  });

  await expect(menu).toBeVisible();

  const cardBox = await card.boundingBox();
  const menuBox = await menu.boundingBox();

  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(
    cardBox!.x + cardBox!.width,
  );
  expect(await hasOverflow()).toBe(false);
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

test('shares the container and row look of the daily tasks', async ({
  page,
}) => {
  const readStyles = () =>
    page.evaluate(() => {
      const pick = (element: Element | null) => {
        const styles = getComputedStyle(element!);

        return {
          backgroundColor: styles.backgroundColor,
          borderRadius: styles.borderRadius,
          borderWidth: styles.borderWidth,
          boxShadow: styles.boxShadow,
          padding: styles.padding,
        };
      };

      return {
        container: pick(
          document.querySelector('[data-testid="task-list-surface"]'),
        ),
        rowRadius: getComputedStyle(document.querySelector('[data-tree-row]')!)
          .borderRadius,
      };
    });

  await openRecurring(page);
  await createDailyActivity(page, 'Stretch');
  await expect(page.locator('[data-tree-row]').first()).toBeVisible();

  const recurring = await readStyles();

  await page.goto('/calendar?day=2026-05-23');
  await page.getByRole('button', { name: labels.checklistEmpty }).click();
  await expect(page.locator('[data-tree-row]').first()).toBeVisible();

  expect(await readStyles()).toEqual(recurring);
  expect(recurring.container.borderWidth).toBe('0px');
  expect(recurring.container.boxShadow).not.toContain('inset');
});

test('keeps the day centered on the screen', async ({ page, isMobile }) => {
  await openRecurring(page);
  await createDailyActivity(page, 'Stretch');

  const box = await page
    .getByRole('region', { name: recurringLabels.dayView })
    .locator('p[aria-live="polite"]')
    .boundingBox();
  const viewport = page.viewportSize();

  expect(
    Math.abs(box!.x + box!.width / 2 - viewport!.width / 2),
  ).toBeLessThanOrEqual(isMobile ? 4 : 2);

  const heightOf = async (control: Locator) => {
    const measured = await control.boundingBox();

    return measured!.height;
  };
  const button = (name: RegExp) => page.getByRole('button', { name });
  const viewTabs = page.getByRole('group', {
    name: /^(recurring view|visualização de recorrentes)$/i,
  });

  expect(
    await Promise.all(
      [
        viewTabs,
        button(recurringLabels.previousDay),
        button(recurringLabels.nextDay),
        button(recurringLabels.chooseDate),
      ].map(heightOf),
    ),
  ).toEqual([36, 36, 36, 36]);

  if (!isMobile) {
    const tabs = await page
      .getByRole('button', { name: recurringLabels.execute })
      .boundingBox();
    const picker = await page
      .getByRole('button', { name: recurringLabels.chooseDate })
      .boundingBox();
    const middle = (item: typeof box) => item!.y + item!.height / 2;

    expect(Math.abs(middle(tabs) - middle(box))).toBeLessThanOrEqual(4);
    expect(Math.abs(middle(picker) - middle(box))).toBeLessThanOrEqual(4);
    expect(picker!.x).toBeGreaterThan(box!.x + box!.width);
    expect(tabs!.x + tabs!.width).toBeLessThan(box!.x);
  }

  await showView(page, recurringLabels.manage);

  expect(
    await Promise.all(
      [
        viewTabs,
        button(labels.categories),
        button(recurringLabels.newActivity),
      ].map(heightOf),
    ),
  ).toEqual([36, 36, 36]);
});

test('starts the content at the same distance as the goals', async ({
  page,
}) => {
  await enterLocalMode(page);
  await page.getByRole('link', { name: labels.goalsLink }).click();
  await page.waitForURL('**/goals');

  const goalsTabs = await page
    .getByRole('button', { name: /^(active|ativas)$/i })
    .locator('..')
    .boundingBox();

  await page.getByRole('link', { name: labels.recurringLink }).click();
  await page.waitForURL('**/recurring');
  await createDailyActivity(page, 'Stretch');

  const recurringTabs = await page
    .getByRole('group', {
      name: /^(recurring view|visualização de recorrentes)$/i,
    })
    .boundingBox();

  expect(recurringTabs!.y).toBe(goalsTabs!.y);
});
