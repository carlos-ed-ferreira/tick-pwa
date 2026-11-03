import { expect, test, type Page } from '@playwright/test';
import { firstChecklistInput, labels } from '../e2e/helpers';

async function signIn(page: Page, day: string) {
  await page.goto('http://127.0.0.1:3102/');
  await page.getByLabel('Email').fill('dev@email.com');
  await page.getByLabel('Password').fill('12341234');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL('**/calendar**');
  await page.goto(`http://127.0.0.1:3102/calendar?day=${day}`);
  await expect(
    page.getByRole('button', { name: labels.backToCalendar }),
  ).toBeVisible();
}

async function addTask(page: Page, title: string) {
  await page.getByRole('button', { name: labels.checklistEmpty }).click();
  await firstChecklistInput(page).fill(title);
  await firstChecklistInput(page).press('Enter');
}

test('persists a pending account edit through full browser closure and offline reopening with a real API', async ({
  playwright,
}, testInfo) => {
  const profile = testInfo.outputPath('persistent-profile');
  const options = { locale: 'en-US', headless: true };
  let context = await playwright.chromium.launchPersistentContext(
    profile,
    options,
  );
  try {
    let page = context.pages()[0];
    await signIn(page, '2026-11-04');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect(
      page.getByRole('button', { name: labels.backToCalendar }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);
    await context.setOffline(true);
    await addTask(page, 'Durable real API task');
    await expect(
      page.getByRole('button', { name: /saved locally, waiting to send/i }),
    ).toBeVisible();
    await context.close();
    context = await playwright.chromium.launchPersistentContext(profile, {
      ...options,
      offline: true,
    });
    await context.setOffline(true);
    page = context.pages()[0];
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await page.goto('http://127.0.0.1:3102/calendar?day=2026-11-04');
    await expect(firstChecklistInput(page)).toHaveValue(
      'Durable real API task',
    );
    await expect(
      page.getByRole('button', { name: /saved locally, waiting to send/i }),
    ).toBeVisible();
    const acknowledged = page.waitForResponse(
      (response) =>
        response.url().endsWith('/rpc/apply_account_operation_batch') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    );
    await context.setOffline(false);
    await acknowledged;
    await expect(page.getByRole('status')).toHaveText('Synced');
    const other = await playwright.chromium.launch();
    try {
      const observer = await other.newContext({ locale: 'en-US' });
      const remote = await observer.newPage();
      await signIn(remote, '2026-11-04');
      await expect(firstChecklistInput(remote)).toHaveValue(
        'Durable real API task',
      );
    } finally {
      await other.close();
    }
  } finally {
    await context.close();
  }
});

test('converges two independent account sessions after concurrent offline edits', async ({
  browser,
}) => {
  const first = await browser.newContext({ locale: 'en-US' });
  const second = await browser.newContext({ locale: 'en-US' });
  try {
    const left = await first.newPage();
    const right = await second.newPage();
    await signIn(left, '2026-11-05');
    await addTask(left, 'Shared real API task');
    await expect(left.getByRole('status')).toHaveText('Synced');
    await signIn(right, '2026-11-05');
    await expect(firstChecklistInput(right)).toHaveValue(
      'Shared real API task',
    );
    await Promise.all([first.setOffline(true), second.setOffline(true)]);
    await firstChecklistInput(left).fill('First device edit');
    await firstChecklistInput(left).press('Tab');
    await firstChecklistInput(right).fill('Second device edit');
    await firstChecklistInput(right).press('Tab');
    await first.setOffline(false);
    await expect(left.getByRole('status')).toHaveText('Synced');
    await second.setOffline(false);
    await expect(right.getByRole('status')).toHaveText('Synced');
    await left.getByRole('button', { name: /synced/i }).click();
    await expect(firstChecklistInput(left)).toHaveValue('Second device edit');
    await expect(firstChecklistInput(right)).toHaveValue('Second device edit');
  } finally {
    await first.close();
    await second.close();
  }
});
