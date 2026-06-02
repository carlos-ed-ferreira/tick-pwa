import { expect, test } from '@playwright/test';
import { enterLocalMode, labels } from './helpers';

test('enters local mode and shows the main app navigation', async ({
  page,
}) => {
  await enterLocalMode(page);

  await expect(
    page.getByRole('link', { name: labels.calendarLink }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: labels.goalsLink }),
  ).toBeVisible();
});
