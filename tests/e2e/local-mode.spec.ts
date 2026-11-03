import { expect, test } from '@playwright/test';
import { enterLocalMode, firstChecklistInput, labels } from './helpers';

test('keeps guest progress editable after closing and reopening without remote entity requests', async ({
  page,
  context,
}) => {
  const remoteEntityRequests: string[] = [];
  context.on('request', (request) => {
    if (/\/(rest|realtime)\/v1\//u.test(request.url())) {
      remoteEntityRequests.push(request.url());
    }
  });
  await enterLocalMode(page);
  await page.goto('/calendar?day=2026-11-02');
  await page.getByRole('button', { name: labels.checklistEmpty }).click();
  await firstChecklistInput(page).fill('Persistent guest task');
  await firstChecklistInput(page).press('Enter');
  await expect(page.locator('[data-checklist-input="true"]')).toHaveCount(2);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/calendar?day=2026-11-02');
  await expect(firstChecklistInput(reopened)).toHaveValue(
    'Persistent guest task',
  );
  const checkbox = reopened.getByRole('checkbox').first();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await reopened.reload();
  await expect(reopened.getByRole('checkbox').first()).toBeChecked();
  expect(remoteEntityRequests).toEqual([]);
});

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
