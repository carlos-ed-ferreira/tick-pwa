import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { chromium, expect } from '@playwright/test';
import { createGoalDemo, createRecurringDemo } from './screenshot-demo.mjs';
import { completeDemoItem } from './screenshot-storage.mjs';

const baseURL = 'http://127.0.0.1:3200';
const outputDirectory = process.env.SCREENSHOT_OUTPUT_DIR ?? 'docs/images';
const firstTask = 'Enviar proposta de identidade visual';
const referenceTime = new Date('2026-11-11T15:00:00-03:00');
const portProbe = createServer();
await new Promise((resolve, reject) => {
  portProbe.once('error', reject);
  portProbe.listen(3200, '127.0.0.1', resolve);
});
await new Promise((resolve, reject) =>
  portProbe.close((error) => (error ? reject(error) : resolve())),
);
const server = spawn(
  'make',
  ['start', 'args=-- --hostname 127.0.0.1 --port 3200'],
  { stdio: 'inherit', detached: true },
);
let browser;

async function capture(page, name, { dialog = false } = {}) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await expect(page.getByRole('dialog')).toHaveCount(dialog ? 1 : 0);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: `${outputDirectory}/${name}.png`,
    animations: 'disabled',
  });
}

async function createContext(options = {}) {
  const context = await browser.newContext({
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
    ...options,
  });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === baseURL
      ? route.continue()
      : route.abort(),
  );
  return context;
}

async function openPage(context, enterGuest = false) {
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.clock.setFixedTime(referenceTime);
  if (enterGuest) {
    await page.goto('/');
    await page.getByText(/^(Usar sem conta|Use without an account)$/i).click();
    await page.waitForURL('**/calendar**');
  }
  return page;
}

async function importCalendar(page, fixture) {
  await page
    .getByRole('button', { name: /^(Importar JSON|Import JSON)$/i })
    .click();
  await page.getByRole('textbox').fill(JSON.stringify(fixture));
  await page.getByRole('button', { name: /^(Importar|Import)$/i }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function captureGoal(page, demo, name) {
  await page.goto(demo.portfolioURL);
  const goal = demo.scenario.goals[0];
  await expect(page.locator('[data-goal-step-input="true"]')).toHaveCount(
    goal.steps.length,
  );
  await expect(
    page.locator('[data-goal-step-input="true"]').first(),
  ).toHaveValue(goal.steps[0]);
  await expect(
    page.getByText(demo.locale === 'en' ? '11/14' : '14/11', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(demo.locale === 'en' ? '11/21' : '21/11', { exact: true }),
  ).toBeVisible();
  await capture(page, name);
}

async function captureOverview(page, demo, name) {
  await page.goto('/goals');
  for (const goal of demo.scenario.goals.filter((goal) => goal.group)) {
    const card = page.getByRole('button', {
      name: new RegExp(`^${goal.group.toUpperCase()}`),
    });
    await expect(card).toBeVisible();
    if (goal.groupCategory)
      await expect(
        card.getByText(goal.groupCategory, { exact: true }),
      ).toBeVisible();
  }
  await capture(page, name);
}

async function showPerformance(page) {
  await page.goto('/recurring?view=performance');
  await page
    .getByRole('button', { name: /^(Últimos 7 dias|Last 7 days)$/i })
    .click();
  await expect(
    page.getByRole('region', { name: /^(Desempenho|Performance)$/i }),
  ).toBeVisible();
}

async function captureExecution(page, scenario, suffix) {
  await page.goto('/recurring');
  await expect(
    page.getByText(new RegExp(`15 / 20 ${scenario.activities[0].unit}`)),
  ).toBeVisible();
  await capture(page, `recurring-execution-${suffix}`);
}

async function capturePerformance(page, suffix) {
  await showPerformance(page);
  await capture(page, `recurring-performance-${suffix}`);
}

async function captureHistory(page, scenario, suffix) {
  await showPerformance(page);
  await page
    .getByRole('button', {
      name: new RegExp(
        `^(Ver histórico|View history): ${scenario.activities[0].name}$`,
      ),
    })
    .click();
  await expect(
    page.getByRole('heading', { name: /^(Histórico|History)$/i }),
  ).toBeVisible();
  await capture(page, `recurring-history-${suffix}`);
}

try {
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(baseURL)).ok;
        } catch {
          return false;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  const executablePath =
    process.env.SCREENSHOT_BROWSER_PATH ??
    (existsSync(chromium.executablePath()) ? undefined : '/snap/bin/chromium');
  browser = await chromium.launch({ executablePath });
  await mkdir(outputDirectory, { recursive: true });
  const context = await createContext();
  const page = await openPage(context, true);
  const fixture = JSON.parse(
    await readFile('docs/examples/calendar-demo.json', 'utf8'),
  );
  await importCalendar(page, fixture);
  for (const [date, completed] of [
    ['2026-09-30', 2],
    ['2026-10-05', 2],
    ['2026-10-16', 3],
    ['2026-10-23', 2],
    ['2026-10-30', 1],
    ['2026-11-02', 1],
    ['2026-11-03', 2],
    ['2026-11-04', 3],
    ['2026-11-06', 1],
    ['2026-11-07', 1],
    ['2026-11-09', 4],
    ['2026-11-10', 1],
  ]) {
    await page.goto(`/calendar?day=${date}`);
    const day = fixture.days.find((day) => day.date === date);
    await expect(
      page.locator('[data-checklist-input="true"]').first(),
    ).toHaveValue(day.items[0].text);
    for (let index = 0; index < completed; index += 1) {
      await completeDemoItem(page, index);
      await page.reload();
      await expect(page.getByRole('checkbox').nth(index)).toBeChecked();
    }
  }
  await page.goto('/calendar?day=2026-11-11');
  await expect(
    page.locator('[data-checklist-input="true"]').first(),
  ).toHaveValue(firstTask);
  for (const index of [1, 2]) {
    await completeDemoItem(page, index);
    await page.reload();
    await expect(page.getByRole('checkbox').nth(index)).toBeChecked();
  }
  await page.goto('/calendar');
  await expect(page.locator('.calendar-day-cell')).toHaveCount(42);
  await expect(
    page.getByRole('button', { name: '11 2/7', exact: true }),
  ).toBeVisible();
  await capture(page, 'calendar-desktop');
  await page.goto('/calendar?day=2026-11-11');
  await page
    .getByRole('button', {
      name: 'Configurar preferências das tarefas',
      exact: true,
    })
    .click();
  await capture(page, 'preferences-desktop', { dialog: true });
  await page.keyboard.press('Escape');
  const demo = await createGoalDemo(page);
  await captureOverview(page, demo, 'goals-overview-desktop');
  const scenario = await createRecurringDemo(page);
  await captureExecution(page, scenario, 'desktop');
  await captureHistory(page, scenario, 'desktop');

  const mobile = await createContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    storageState: await context.storageState({ indexedDB: true }),
  });
  const mobilePage = await openPage(mobile);
  await mobilePage.goto('/calendar');
  await expect(
    mobilePage.locator('[data-checklist-input="true"]').first(),
  ).toHaveValue(firstTask);
  await capture(mobilePage, 'calendar-mobile');
  await captureOverview(mobilePage, demo, 'goals-overview-mobile');
  await mobilePage.goto('/calendar');
  await mobilePage
    .getByRole('button', {
      name: 'Configurar preferências das tarefas',
      exact: true,
    })
    .click();
  await capture(mobilePage, 'preferences-mobile', { dialog: true });
  await mobilePage.keyboard.press('Escape');
  await captureExecution(mobilePage, scenario, 'mobile');
  await captureHistory(mobilePage, scenario, 'mobile');

  const englishContext = await createContext({ locale: 'en-US' });
  const englishPage = await openPage(englishContext, true);
  const englishFixture = JSON.parse(
    await readFile('docs/examples/calendar-demo-en.json', 'utf8'),
  );
  await importCalendar(englishPage, englishFixture);
  await englishPage.goto('/calendar?day=2026-11-11');
  await expect(
    englishPage.locator('[data-checklist-input="true"]').first(),
  ).toHaveValue(englishFixture.days[0].items[0].text);
  for (const index of [1, 2]) {
    await completeDemoItem(englishPage, index);
    await englishPage.reload();
    await expect(englishPage.getByRole('checkbox').nth(index)).toBeChecked();
  }
  await expect(
    englishPage
      .getByRole('textbox', { name: 'Task time', exact: true })
      .first(),
  ).toHaveValue('2:30 PM');
  await capture(englishPage, 'tasks-desktop');
  const englishDemo = await createGoalDemo(englishPage, 'en');
  await captureGoal(englishPage, englishDemo, 'goals-desktop');
  await createRecurringDemo(englishPage, 'en');
  await capturePerformance(englishPage, 'desktop');
  const englishMobileContext = await createContext({
    locale: 'en-US',
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    storageState: await englishContext.storageState({ indexedDB: true }),
  });
  const englishMobilePage = await openPage(englishMobileContext);
  await captureGoal(englishMobilePage, englishDemo, 'goals-mobile');
  await capturePerformance(englishMobilePage, 'mobile');

  if (process.env.SCREENSHOT_AUDIT === '1') {
    const { auditUI } = await import('./audit-ui.mjs');
    await auditUI({
      browser,
      baseURL,
      context,
      englishContext,
      demo,
      englishDemo,
      outputDirectory,
    });
  }
  if (process.env.SCREENSHOT_REVIEW === '1') {
    for (const width of [320, 360, 390, 430, 768]) {
      await mobilePage.setViewportSize({ width, height: 915 });
      await mobilePage.goto('/calendar');
      await expect(
        mobilePage.locator('[data-checklist-input="true"]').first(),
      ).toHaveValue(firstTask);
      await capture(mobilePage, `calendar-mobile-${width}`);
      await captureGoal(mobilePage, demo, `goals-mobile-${width}`);
      await captureExecution(mobilePage, scenario, `mobile-${width}`);
    }
  }
  console.log(
    `Capturas salvas em ${outputDirectory}; dados exclusivamente fictícios.`,
  );
} finally {
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null)
    process.kill(-server.pid, 'SIGTERM');
}
