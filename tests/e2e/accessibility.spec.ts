import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { enterLocalMode } from './helpers';

for (const route of ['/calendar', '/goals']) {
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
