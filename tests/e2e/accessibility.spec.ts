import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { enterLocalMode } from './helpers';

for (const route of ['/calendar', '/goals', '/recurring']) {
  test(`has no serious or critical accessibility violations on ${route}`, async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
  });
}

async function expectNoSeriousViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  expect(
    result.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    ),
  ).toEqual([]);
}

test('has no serious or critical accessibility violations in the recurring dialogs', async ({
  page,
}) => {
  await enterLocalMode(page);
  await page.goto('/recurring');
  await page
    .getByRole('button', { name: /^(new activity|nova atividade)$/i })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoSeriousViolations(page);

  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(cancel|cancelar)$/i })
    .last()
    .click();
  await page
    .getByRole('button', { name: /^(choose date|escolher data)$/i })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoSeriousViolations(page);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`keeps the single theme with the system in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await enterLocalMode(page);
    await page.goto('/recurring');

    const colors = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);

      return {
        background: styles.getPropertyValue('--background').trim(),
        foreground: styles.getPropertyValue('--foreground').trim(),
        surface: styles.getPropertyValue('--surface').trim(),
        colorScheme: styles.colorScheme,
      };
    });

    expect(colors).toEqual({
      background: '#0c131a',
      foreground: '#f8f3ea',
      surface: '#16202c',
      colorScheme: 'dark',
    });
  });
}
