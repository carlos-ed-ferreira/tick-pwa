import { expect, test, type Page, type BrowserContext } from '@playwright/test';
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

async function resumeAndConfirmMutation(
  context: BrowserContext,
  page: Page,
  entityType: string,
  expected: Record<string, string>,
) {
  const acknowledged = page.waitForResponse((response) => {
    const request = response.request();
    if (
      !response.url().endsWith('/rpc/apply_account_operation_batch') ||
      request.method() !== 'POST' ||
      response.status() !== 200
    )
      return false;
    const body = request.postDataJSON() as {
      p_mutations: Array<{
        entity_type: string;
        payload: Record<string, unknown>;
      }>;
    };
    return body.p_mutations.some(
      (mutation) =>
        mutation.entity_type === entityType &&
        Object.entries(expected).every(
          ([key, value]) => mutation.payload[key] === value,
        ),
    );
  });
  await context.setOffline(false);
  await acknowledged;
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const open = indexedDB.open('tick');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const database = open.result;
              const count = database
                .transaction('syncOutbox', 'readonly')
                .objectStore('syncOutbox')
                .count();
              count.onerror = () => {
                database.close();
                reject(count.error);
              };
              count.onsuccess = () => {
                database.close();
                resolve(count.result);
              };
            };
          }),
      ),
    )
    .toBe(0);
  await expect(page.getByRole('status')).toHaveText('Synced');
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
    await right.route('**/rpc/apply_account_operation_batch', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });
    await Promise.all([first.setOffline(true), second.setOffline(true)]);
    await firstChecklistInput(left).fill('First device edit');
    await firstChecklistInput(left).press('Tab');
    await firstChecklistInput(right).fill('Second device edit');
    await firstChecklistInput(right).press('Tab');
    await Promise.all([
      expect(
        left.getByRole('button', { name: /saved locally, waiting to send/i }),
      ).toBeVisible(),
      expect(
        right.getByRole('button', { name: /saved locally, waiting to send/i }),
      ).toBeVisible(),
    ]);
    await resumeAndConfirmMutation(first, left, 'checklistItem', {
      text: 'First device edit',
    });
    await resumeAndConfirmMutation(second, right, 'checklistItem', {
      text: 'Second device edit',
    });
    await left.getByRole('button', { name: /synced/i }).click();
    await expect(firstChecklistInput(left)).toHaveValue('Second device edit');
    await expect(firstChecklistInput(right)).toHaveValue('Second device edit');
  } finally {
    await first.close();
    await second.close();
  }
});

test('converges the same recurring answer given offline by two sessions', async ({
  browser,
}) => {
  const first = await browser.newContext({ locale: 'en-US' });
  const second = await browser.newContext({ locale: 'en-US' });
  const activity = `Shared recurring ${Date.now()}`;
  const doneName = `Done: ${activity}`;
  const notDoneName = `Not done: ${activity}`;

  try {
    const left = await first.newPage();
    const right = await second.newPage();

    await signIn(left, '2026-11-05');
    await left.goto('http://127.0.0.1:3102/recurring');
    await left
      .getByRole('button', {
        name: /^(new activity|start by creating a recurring activity)$/i,
      })
      .click();
    await left.getByRole('dialog').getByLabel('Activity name').fill(activity);
    await left
      .getByRole('dialog')
      .getByRole('button', { name: 'Save' })
      .click();
    await expect(
      left.getByRole('button', { name: doneName, exact: true }),
    ).toBeVisible();
    await expect(left.getByRole('status')).toHaveText('Synced');

    await signIn(right, '2026-11-05');
    await right.goto('http://127.0.0.1:3102/recurring');
    await expect(
      right.getByRole('button', { name: doneName, exact: true }),
    ).toBeVisible();

    await Promise.all([first.setOffline(true), second.setOffline(true)]);
    await left.getByRole('button', { name: doneName, exact: true }).click();
    await right.getByRole('button', { name: notDoneName, exact: true }).click();

    await Promise.all([
      expect(
        left.getByRole('button', { name: /saved locally, waiting to send/i }),
      ).toBeVisible(),
      expect(
        right.getByRole('button', { name: /saved locally, waiting to send/i }),
      ).toBeVisible(),
    ]);
    await resumeAndConfirmMutation(first, left, 'recurrenceResponse', {
      status: 'done',
    });
    await resumeAndConfirmMutation(second, right, 'recurrenceResponse', {
      status: 'not_done',
    });
    await left.getByRole('button', { name: /synced/i }).click();

    for (const page of [left, right]) {
      await expect(
        page.getByRole('button', { name: notDoneName, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.getByRole('button', { name: doneName, exact: true }),
      ).toHaveAttribute('aria-pressed', 'false');
    }
  } finally {
    await first.close();
    await second.close();
  }
});
