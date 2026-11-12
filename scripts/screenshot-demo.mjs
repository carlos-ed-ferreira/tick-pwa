import { expect } from '@playwright/test';
import { demoScenarios } from './screenshot-scenarios.mjs';
import { completeDemoItem } from './screenshot-storage.mjs';

const colors = ['#7db4f0', '#a8d5ba', '#f0c38e'];

async function selectCategory(page, trigger, name) {
  await trigger.click();
  await page
    .locator('.modal-panel--flat')
    .getByRole('button', { name, exact: true })
    .click();
  await expect(page.locator('.modal-panel--flat')).toHaveCount(0);
}

async function configureGoalCategories(page, scenario) {
  await page.goto('/goals');
  await page
    .getByRole('button', { name: /^(Categorias|Categories)$/i })
    .click();
  const dialog = page.getByRole('dialog');
  for (const [heading, names] of scenario.categorySections) {
    const section = dialog.locator('section').filter({
      has: page.getByRole('heading', { name: heading, exact: true }),
    });
    const inputs = section.getByRole('textbox', {
      name: /^(Nome da categoria|Category name)$/i,
    });
    await expect(inputs).toHaveCount(3);
    for (const [index, name] of names.entries()) {
      await inputs.nth(index).fill(name);
      await inputs.nth(index).blur();
      await section
        .locator('input[type="color"]')
        .nth(index)
        .fill(colors[index]);
    }
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
}

async function createGoal(
  page,
  { title, category, steps, stepCategories = [], dates = [] },
  locale,
) {
  await page.goto('/goals');
  await page
    .getByRole('button', { name: /^(Nova meta|New goal)$/i })
    .first()
    .click();
  await page.waitForURL(/\/goals\?goal=.+/);
  const url = page.url();
  const titleInput = page.getByRole('textbox', {
    name: /^(Renomear meta|Rename goal)$/i,
  });
  await titleInput.fill(title);
  await titleInput.blur();
  if (category) {
    await selectCategory(
      page,
      page.getByRole('button', {
        name: /^(Atribuir categoria da meta|Assign goal category)$/i,
      }),
      category,
    );
  }
  await page
    .getByRole('button', {
      name: /^(comece esta meta adicionando uma etapa|start this goal by adding a step)$/i,
    })
    .click();
  for (const [index, text] of steps.entries()) {
    const input = page.locator('[data-goal-step-input="true"]').nth(index);
    await input.fill(text);
    if (index < steps.length - 1) await input.press('Enter');
    else await input.blur();
  }
  const rows = page
    .locator('[data-tree-row]')
    .filter({ has: page.locator('[data-goal-step-input="true"]') });
  for (const [index, name] of stepCategories.entries()) {
    const row = rows.nth(index);
    await row
      .getByRole('button', { name: /^(Opções extras|Extra options)$/i })
      .click();
    await page
      .getByRole('button', { name: /^(Atribuir categoria|Assign category)$/i })
      .hover();
    await page
      .locator('[data-task-category-submenu]')
      .getByRole('button', { name, exact: true })
      .click();
    await expect(row.getByText(name, { exact: true })).toBeVisible();
  }
  for (const [index, day] of dates) {
    const trigger = rows.nth(index).getByRole('button', {
      name: /^(abrir seletor de data para data|open date picker for date)$/i,
    });
    await trigger.click();
    await page
      .getByRole('dialog')
      .getByRole('button', {
        name: new RegExp(`(${day}.*novembro.*2026|November ${day}, 2026)`, 'i'),
      })
      .click();
    await expect(trigger).toHaveText(
      locale === 'en' ? `11/${day}` : `${day}/11`,
    );
  }
  await completeDemoItem(page, 0, 'goalSteps');
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.reload();
  await expect(titleInput).toHaveValue(title.toUpperCase());
  await expect(page.locator('[data-goal-step-input="true"]')).toHaveCount(
    steps.length,
  );
  return url;
}

async function groupGoal(page, { title, group, groupCategory }) {
  await page.goto('/goals');
  const card = page.getByRole('button', {
    name: title.toUpperCase(),
    exact: true,
  });
  await card
    .getByRole('button', { name: /^(Ações da meta|Goal actions)$/i })
    .click();
  await page
    .getByRole('button', { name: /^(Criar grupo|Create group)$/i })
    .click();
  const dialog = page.getByRole('dialog', {
    name: /^(Criar grupo|Create group)$/i,
  });
  await dialog
    .getByRole('textbox', { name: /^(Nome do grupo|Group name)$/i })
    .fill(group);
  await dialog
    .getByRole('button', { name: /^(Criar grupo|Create group)$/i })
    .click();
  await expect(dialog).toHaveCount(0);
  if (groupCategory) {
    await page
      .getByRole('button', { name: new RegExp(`^${group.toUpperCase()}`) })
      .click();
    await selectCategory(
      page,
      page.getByRole('button', {
        name: /^(Atribuir categoria do grupo|Assign group category)$/i,
      }),
      groupCategory,
    );
    await page.goto('/goals');
  }
}

export async function createGoalDemo(page, locale = 'pt-BR') {
  const scenario = demoScenarios[locale];
  await configureGoalCategories(page, scenario);
  let portfolioURL;
  for (const [index, goal] of scenario.goals.entries()) {
    const url = await createGoal(page, goal, locale);
    if (index === 0) portfolioURL = url;
    if (goal.group) await groupGoal(page, goal);
  }
  return { portfolioURL, scenario, locale };
}

async function createActivity(page, activity, scenario) {
  const activitiesTab = page.getByRole('button', {
    name: /^(Atividades|Activities)$/i,
  });
  if (await activitiesTab.isVisible()) await activitiesTab.click();
  await page
    .getByRole('button', {
      name: /^(nova atividade|comece criando uma atividade recorrente|new activity|start by creating a recurring activity)$/i,
    })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: /^(Nome da atividade|Activity name)$/i })
    .fill(activity.name);
  await selectCategory(
    page,
    dialog.getByRole('button', {
      name: /^(Atribuir categoria|Assign category)$/i,
    }),
    activity.category,
  );
  if (activity.target) {
    await dialog
      .getByRole('button', { name: /^(Medir quantidade|Measure an amount)$/i })
      .first()
      .click();
    await dialog
      .getByLabel(/^(Meta mínima|Minimum target)$/i)
      .fill(String(activity.target));
    await dialog.getByLabel(/^(Unidade|Unit)$/i).fill(activity.unit);
  }
  if (activity.weekdays) {
    await dialog.getByRole('radio', { name: /^(Semanas|Weeks)$/i }).click();
    for (const weekday of activity.weekdays) {
      await dialog
        .getByRole('button', { name: scenario.weekdays[weekday], exact: true })
        .click();
    }
  }
  await dialog.getByRole('button', { name: /^(Salvar|Save)$/i }).click();
  await expect(dialog).toHaveCount(0);
}

async function recordActivity(page, dayView, activity, value, locale) {
  if (activity.target) {
    const row = dayView
      .locator('[data-tree-row]')
      .filter({ has: page.getByText(activity.name, { exact: true }) });
    await row
      .getByRole('button', { name: /^(Registrar quantidade|Record amount):/i })
      .click();
    const dialog = page.getByRole('dialog');
    const quantity =
      locale === 'pt-BR' ? String(value).replace('.', ',') : String(value);
    await dialog
      .getByLabel(/^(Quantidade realizada|Amount done)$/i)
      .fill(quantity);
    await dialog.getByRole('button', { name: /^(Salvar|Save)$/i }).click();
    await expect(dialog).toHaveCount(0);
    const formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 3,
    });
    await expect(
      row.getByText(
        `${formatter.format(value)} / ${formatter.format(activity.target)} ${activity.unit}`,
        { exact: false },
      ),
    ).toBeVisible();
  } else {
    const action =
      locale === 'pt-BR'
        ? value
          ? 'Feito'
          : 'Não feito'
        : value
          ? 'Done'
          : 'Not done';
    const button = dayView.getByRole('button', {
      name: `${action}: ${activity.name}`,
      exact: true,
    });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
}

export async function createRecurringDemo(page, locale = 'pt-BR') {
  const scenario = demoScenarios[locale];
  await page.clock.setFixedTime(new Date('2026-11-02T15:00:00-03:00'));
  await page.goto('/recurring');
  for (const activity of scenario.activities)
    await createActivity(page, activity, scenario);
  await page.clock.setFixedTime(new Date('2026-11-11T15:00:00-03:00'));
  await page.goto('/recurring');
  const dayView = page.getByRole('region', {
    name: /^(Visão do dia|Day view)$/i,
  });
  for (let day = 11; day > 2; day -= 1) {
    await dayView
      .getByRole('button', { name: /^(Dia anterior|Previous day)$/i })
      .click();
  }
  for (let day = 2; day <= 11; day += 1) {
    for (const activity of scenario.activities) {
      const value = activity.values[day - 2];
      if (value === null) continue;
      await recordActivity(page, dayView, activity, value, locale);
    }
    if (day < 11)
      await dayView
        .getByRole('button', { name: /^(Próximo dia|Next day)$/i })
        .click();
  }
  return scenario;
}
