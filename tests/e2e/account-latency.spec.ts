import { expect, test, type Page, type Route } from '@playwright/test';
import { firstChecklistInput, labels } from './helpers';

const userId = '00000000-0000-4000-8000-000000000001';
const accessToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDAwMDAwMDAwLCJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJlbWFpbCI6ImRldkBlbWFpbC5jb20iLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature';

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  });
}

async function mockDelayedSupabase(page: Page) {
  let revision = 0;

  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (
      url.pathname === '/auth/v1/token' &&
      url.searchParams.get('grant_type') === 'password'
    ) {
      await fulfillJson(route, {
        access_token: accessToken,
        expires_in: 3600,
        refresh_token: 'refresh-token',
        token_type: 'bearer',
        user: {
          id: userId,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'dev@email.com',
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-06-19T12:00:00.000Z',
        },
      });
      return;
    }

    if (url.pathname.includes('/account_access')) {
      await fulfillJson(route, { active: true });
      return;
    }

    if (url.pathname.includes('/profiles')) {
      await fulfillJson(route, {});
      return;
    }

    if (request.method() === 'GET') {
      await fulfillJson(route, []);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
    revision += 1;
    await fulfillJson(route, { revision });
  });
}

test('keeps authenticated checklist interactions responsive while Supabase is delayed', async ({
  page,
}) => {
  await mockDelayedSupabase(page);
  await page.goto('/');

  await page.getByLabel('Email').fill('dev@email.com');
  await page.getByLabel('Password').fill('12341234');
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await page.waitForURL('**/calendar**');
  await page.goto('/calendar?day=2026-05-21');

  await expect(
    page.getByRole('button', { name: labels.backToCalendar }),
  ).toBeVisible();
  await page.getByRole('button', { name: labels.checklistEmpty }).click();

  const itemInput = firstChecklistInput(page);
  await itemInput.fill('Authenticated delayed item');
  await itemInput.press('Enter');

  await expect(page.locator('[data-checklist-input="true"]')).toHaveCount(2);
  await expect(
    page.locator('[data-checklist-input="true"]').nth(1),
  ).toBeFocused();

  const firstCheckbox = page.getByRole('checkbox').first();
  await firstCheckbox.click();
  await expect(firstCheckbox).toBeChecked();
});
