import { mkdir, writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function auditUI({
  browser,
  baseURL,
  context,
  englishContext,
  demo,
  englishDemo,
  outputDirectory,
}) {
  const results = [];
  const directory = `${outputDirectory}/surfaces`;
  await mkdir(directory, { recursive: true });
  for (const [locale, source, goal] of [
    ['pt-BR', context, demo],
    ['en', englishContext, englishDemo],
  ]) {
    const storageState = await source.storageState({ indexedDB: true });
    for (const mobile of [false, true]) {
      const options = {
        baseURL,
        locale: locale === 'en' ? 'en-US' : locale,
        timezoneId: 'America/Sao_Paulo',
        viewport: mobile
          ? { width: 412, height: 915 }
          : { width: 1440, height: 960 },
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
      };
      const profile = await browser.newContext({ ...options, storageState });
      await profile.route('**/*', (route) =>
        new URL(route.request().url()).origin === baseURL
          ? route.continue()
          : route.abort(),
      );
      const page = await profile.newPage();
      page.setDefaultTimeout(4500);
      await page.clock.setFixedTime(new Date('2026-11-11T15:00:00-03:00'));
      const prefix = `${locale}-${mobile ? 'touch' : 'desktop'}`;
      const record = async (name, action) => {
        try {
          await action();
          if (name !== 'offline-fallback')
            await expect(page.locator('[data-header-actions]')).toBeVisible();
          if (name === 'calendar') {
            if (mobile)
              await expect(
                page.locator('[data-checklist-input="true"]').first(),
              ).toHaveValue(/\S/);
            else
              await expect(
                page
                  .locator('.calendar-day-cell')
                  .filter({ hasText: /2\s*\/\s*7/ })
                  .first(),
              ).toBeVisible();
          }
          if (name === 'day' || name === 'selection')
            await expect(
              page.locator('[data-checklist-input="true"]').first(),
            ).toHaveValue(/\S/);
          if (name === 'goals')
            await expect(
              page.getByRole('button', { name: /^PORTF/ }).first(),
            ).toBeVisible();
          if (name === 'goal')
            await expect(
              page.locator('[data-goal-step-input="true"]'),
            ).toHaveCount(goal.scenario.goals[0].steps.length);
          if (name === 'recurring-execute')
            await expect(page.getByText(/15 \/ 20/)).toBeVisible();
          if (name === 'categories')
            await expect(
              page
                .getByRole('dialog')
                .getByRole('textbox', {
                  name: /^(Nome da categoria|Category name)$/,
                })
                .first(),
            ).toBeVisible();
          if (
            name === 'performance' ||
            (name.startsWith('width-') && page.url().includes('/recurring'))
          )
            await expect(
              page
                .getByRole('button', { name: /^(Ver histórico|View history):/ })
                .first(),
            ).toBeVisible();
          if (name === 'activities')
            await expect(
              page
                .getByText(goal.scenario.activities[0].name, { exact: true })
                .first(),
            ).toBeVisible();
          if (name.startsWith('width-')) {
            const loading = page.getByText(
              /^(Preparing Tick|Preparando o Tick|Loading|Carregando)/i,
            );
            await expect(loading).toHaveCount(0);
            if (page.url().includes('/calendar')) {
              if (mobile && page.viewportSize().width < 900)
                await expect(
                  page.locator('[data-checklist-input="true"]').first(),
                ).toHaveValue(/\S/);
              else
                await expect(
                  page
                    .locator('.calendar-day-cell')
                    .filter({ hasText: /2\s*\/\s*7/ })
                    .first(),
                ).toBeVisible();
            }
            if (page.url().includes('/goals'))
              await expect(
                page.getByRole('button', { name: /^PORTF/ }).first(),
              ).toBeVisible();
          }
          await page.evaluate(() => document.fonts.ready);
          const geometry = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth,
            dialogs: [...document.querySelectorAll('[role="dialog"]')].map(
              (element) => ({
                name:
                  element.getAttribute('aria-label') ||
                  element.textContent.slice(0, 80),
                height: element.getBoundingClientRect().height,
                viewport: innerHeight,
              }),
            ),
          }));
          await page.screenshot({
            path: `${directory}/${prefix}-${name}.png`,
            animations: 'disabled',
          });
          const violations = [
            'calendar',
            'day',
            'goals',
            'recurring-execute',
            'performance',
            'recurrence-editor',
            'offline-fallback',
          ].includes(name)
            ? (await new AxeBuilder({ page }).analyze()).violations.map(
                ({ id, impact, nodes }) => ({
                  id,
                  impact,
                  count: nodes.length,
                }),
              )
            : [];
          results.push({
            locale,
            mobile,
            name,
            observed: true,
            ...geometry,
            violations,
          });
        } catch (error) {
          results.push({
            locale,
            mobile,
            name,
            observed: false,
            reason: error.message.split('\n')[0],
          });
        }
      };
      const click = (expression) =>
        page.getByRole('button', { name: expression }).first().click();
      const close = async () => {
        await page.keyboard.press('Escape');
      };
      await record('calendar', () => page.goto('/calendar'));
      await record('language', () => click(/^(Idioma|Language):/));
      await close();
      await record('day', () => page.goto('/calendar?day=2026-11-11'));
      await record('preferences', () =>
        click(
          /^(Configurar preferências das tarefas|Configure task preferences)$/,
        ),
      );
      await close();
      await record('categories', () => click(/^(Categorias|Categories)$/));
      await close();
      await record('transfer', () =>
        click(/^(Mover ou duplicar dia|Move or duplicate day)$/),
      );
      await close();
      await record('row-actions', () =>
        page
          .locator('[data-tree-row]')
          .first()
          .getByRole('button', { name: /^(Opções extras|Extra options)$/ })
          .click(),
      );
      await close();
      await record('selection', async () => {
        await page.goto('/calendar?day=2026-11-11');
        const row = page.locator('[data-tree-row]').first();
        if (mobile)
          await row
            .getByRole('button', { name: /^(Opções extras|Extra options)$/ })
            .click();
        await page
          .getByRole('button', { name: /^(Selecionar tarefa|Select task)$/ })
          .first()
          .click();
      });
      await record('clear-bulk', async () => {
        await page.goto('/calendar');
        if (mobile) await click(/^(Opções do calendário|Calendar options)$/);
        await click(/^(Limpar em lote|Clear in bulk)$/);
      });
      await close();
      await record('import', async () => {
        await page.goto('/calendar');
        if (mobile) await click(/^(Opções do calendário|Calendar options)$/);
        await click(/^(Importar JSON|Import JSON)$/);
      });
      await record('import-error', async () => {
        await page.getByRole('dialog').getByRole('textbox').fill('{invalid');
        await click(/^(Importar|Import)$/);
      });
      await close();
      await record('bulk', async () => {
        await page.goto('/calendar');
        if (mobile) await click(/^(Opções do calendário|Calendar options)$/);
        await click(/^(Criar em lote|Create in bulk)$/);
      });
      await close();
      await record('goals', () => page.goto('/goals'));
      await record('archived-goals', () => click(/^(Arquivadas|Archived)$/));
      await record('goal-group', async () => {
        await page.goto('/goals');
        await click(
          new RegExp(
            `^${goal.scenario.goals.find((item) => item.group).group.toUpperCase()}`,
          ),
        );
      });
      await record('goal', () => page.goto(goal.portfolioURL));
      await record('goal-actions', async () => {
        if (mobile) await click(/^(Mais opções|More options)$/);
        else
          await expect(
            page.getByRole('button', { name: /^(Voltar|Back)$/ }),
          ).toBeVisible();
      });
      await close();
      await record('goal-date-picker', async () => {
        await page.goto(goal.portfolioURL);
        const row = page.locator('[data-tree-row]').nth(1);
        if (mobile)
          await row
            .getByRole('button', { name: /^(Opções extras|Extra options)$/ })
            .click();
        await page
          .getByRole('button', {
            name: /^(Abrir seletor de data para Data|Open date picker for Date)$/i,
          })
          .first()
          .click();
      });
      await close();
      await close();
      await record('archive-confirmation', async () => {
        if (mobile) await click(/^(Mais opções|More options)$/);
        await click(/^(Arquivar meta|Archive goal)$/);
      });
      await close();
      await record('recurring-execute', () => page.goto('/recurring'));
      await record('quantity', () =>
        click(/^(Registrar quantidade|Record amount)/),
      );
      await close();
      await record('activities', () => page.goto('/recurring?view=activities'));
      await record('recurrence-editor', () =>
        click(/^(Nova atividade|New activity)$/),
      );
      await close();
      await record('performance', () =>
        page.goto('/recurring?view=performance'),
      );
      await record('custom-period', () => click(/^(Personalizado|Custom)$/));
      await record('history', () => click(/^(Ver histórico|View history):/));
      await record('offline-fallback', () => page.goto('/~offline'));
      for (const width of mobile
        ? [320, 360, 390, 430, 768, 900]
        : [640, 1024]) {
        await page.setViewportSize({ width, height: 915 });
        for (const path of [
          '/calendar',
          '/goals',
          '/recurring?view=performance',
        ]) {
          await record(`width-${width}-${path.split('?')[0].slice(1)}`, () =>
            page.goto(path),
          );
        }
      }
      await profile.close();
      const visitor = await browser.newContext(options);
      await visitor.route('**/*', (route) =>
        new URL(route.request().url()).origin === baseURL
          ? route.continue()
          : route.abort(),
      );
      const entry = await visitor.newPage();
      await entry.goto('/');
      await expect(
        entry.getByRole('button', { name: /^(Entrar|Sign in)$/ }),
      ).toBeVisible();
      await entry.screenshot({ path: `${directory}/${prefix}-access.png` });
      await entry.getByRole('button', { name: /^(Entrar|Sign in)$/ }).click();
      await entry.screenshot({
        path: `${directory}/${prefix}-access-errors.png`,
      });
      results.push({
        locale,
        mobile,
        name: 'access-and-validation',
        observed: true,
      });
      await visitor.close();
      for (const allowed of [false, true]) {
        const account = await browser.newContext(options);
        const user = {
          id: '00000000-0000-4000-8000-000000000002',
          email: 'audit@example.invalid',
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-01-01T00:00:00Z',
        };
        const encoded = (value) =>
          Buffer.from(JSON.stringify(value)).toString('base64url');
        const token = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', exp: 2000000000 })}.synthetic`;
        await account.route('**/*', async (route) => {
          const url = new URL(route.request().url());
          if (url.origin === baseURL) return route.continue();
          let body;
          if (url.pathname === '/auth/v1/token')
            body = {
              access_token: token,
              refresh_token: 'synthetic-audit',
              expires_in: 3600,
              token_type: 'bearer',
              user,
            };
          else if (url.pathname === '/auth/v1/user') body = user;
          else if (url.pathname.includes('/account_access'))
            body = { active: allowed };
          else if (url.pathname.startsWith('/rest/v1/')) body = [];
          else return route.abort();
          return route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify(body),
          });
        });
        const auth = await account.newPage();
        auth.setDefaultTimeout(5000);
        try {
          await auth.goto('/');
          await auth
            .getByRole('textbox', { name: /^(E-mail|Email)$/ })
            .fill(user.email);
          await auth
            .getByLabel(/^(Senha|Password)$/)
            .fill('synthetic-audit-only');
          await auth
            .getByRole('button', { name: /^(Entrar|Sign in)$/ })
            .click();
          if (allowed)
            await expect(auth.locator('[data-header-actions]')).toBeVisible();
          else
            await expect(
              auth.getByRole('button', { name: /^(Sair|Sign out)$/ }),
            ).toBeVisible();
          await auth.screenshot({
            path: `${directory}/${prefix}-account-${allowed ? 'mocked' : 'denied'}.png`,
          });
          results.push({
            locale,
            mobile,
            name: allowed ? 'account-mocked' : 'access-denied',
            observed: true,
            simulated: true,
          });
        } catch (error) {
          results.push({
            locale,
            mobile,
            name: allowed ? 'account-mocked' : 'access-denied',
            observed: false,
            reason: error.message.split('\n')[0],
          });
        }
        await account.close();
      }
    }
  }
  results.push({
    name: 'transient-loading-storage-unavailable-real-keyboard',
    observed: false,
    reason:
      'Loading transitorio, armazenamento indisponivel e teclado virtual fisico exigem comprovacao complementar; leitura estatica nao comprova observacao visual.',
  });
  await writeFile(
    `${outputDirectory}/audit.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(
    `Auditoria: ${results.filter((result) => result.observed).length} cenarios observados; resultados em ${outputDirectory}/audit.json`,
  );
}
