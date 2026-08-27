import { expect, test } from '@playwright/test';
import { enterLocalMode, firstChecklistInput, labels } from './helpers';

test.describe('mobile layout', () => {
  test.skip(({ isMobile }) => !isMobile, 'covers the touch composition only');

  test('never scrolls the page horizontally', async ({ page }) => {
    await enterLocalMode(page);

    for (const path of ['/calendar', '/goals']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();

      const hasHorizontalScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );

      expect(hasHorizontalScroll, `${path} overflows horizontally`).toBe(false);
    }
  });

  test('renders the month grid in the compact density', async ({ page }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');

    const dayCell = page.locator('.calendar-day-cell').first();
    await expect(dayCell).toBeVisible();

    const box = await dayCell.boundingBox();

    expect(box?.width).toBeLessThan(72);
    expect(box?.height).toBeGreaterThanOrEqual(60);
  });

  test('opens the day with a single tap', async ({ page }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');

    await page.locator('.calendar-day-cell').nth(15).tap();

    await expect(
      page.getByRole('button', { name: labels.backToCalendar }),
    ).toBeVisible();
  });

  test('expands icon control hit areas to the touch minimum', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');
    await page.locator('.calendar-day-cell').nth(15).tap();
    await page.getByRole('button', { name: labels.checklistEmpty }).tap();
    await expect(firstChecklistInput(page)).toBeVisible();

    const hitArea = await page
      .locator('.touch-target')
      .first()
      .evaluate((element) => {
        const style = window.getComputedStyle(element, '::before');

        return { minHeight: style.minHeight, minWidth: style.minWidth };
      });

    expect(hitArea.minWidth).toBe('44px');
    expect(hitArea.minHeight).toBe('44px');
  });

  test('keeps positioned controls anchored when the hit area grows', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page
      .getByRole('button', { name: /create in bulk|criar em lote/i })
      .tap();

    const startDateInput = page.getByRole('textbox', {
      name: /start date|data inicial/i,
    });
    await startDateInput.fill('15072026');

    const clearButton = page.locator('.touch-target.absolute').first();

    await expect(clearButton).toHaveCSS('position', 'absolute');
  });

  test('keeps the checklist drag handle out of the scroll gesture', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');
    await page.locator('.calendar-day-cell').nth(15).tap();
    await page.getByRole('button', { name: labels.checklistEmpty }).tap();

    const input = firstChecklistInput(page);
    await input.fill('Mobile drag');
    await input.press('Enter');

    const dragHandle = page.locator('.tree-drag-handle').first();
    await expect(dragHandle).toBeVisible();
    await expect(dragHandle).toHaveCSS('touch-action', 'none');
  });
});
