import { expect, test } from '@playwright/test';
import {
  enterLocalMode,
  firstChecklistInput,
  labels,
  openCalendarBulkCreate,
  openMonthGrid,
} from './helpers';

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

  test('opens the calendar on the week composition', async ({ page }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');

    await expect(page.getByTestId('calendar-week-day')).toHaveCount(7);
    await expect(page.locator('.calendar-day-cell')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: labels.checklistEmpty }),
    ).toBeVisible();
  });

  test('renders the month grid in the compact density inside the sheet', async ({
    page,
    isMobile,
  }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');
    await openMonthGrid(page, isMobile);

    const dayCell = page.locator('.calendar-day-cell').first();
    const box = await dayCell.boundingBox();

    expect(box?.width).toBeLessThan(72);
    expect(box?.height).toBeGreaterThanOrEqual(60);
  });

  test('selects a day from the week strip without leaving the agenda', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');

    const secondDay = page.getByTestId('calendar-week-day').nth(2);
    await secondDay.tap();

    await expect(secondDay).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(
      page.getByRole('button', { name: labels.backToCalendar }),
    ).toHaveCount(0);
  });

  test('keeps the ignored count visible on the week strip', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');

    await page.getByRole('button', { name: labels.checklistEmpty }).tap();

    const input = firstChecklistInput(page);
    await input.fill('Ignored on mobile');
    await input.press('Enter');

    await page
      .getByRole('button', { name: labels.configureTaskPreferences })
      .tap();
    await page.getByRole('radio', { name: labels.enableIgnoredState }).tap();
    await page.getByRole('button', { name: labels.closeDialog }).first().tap();

    const checkbox = page.getByRole('checkbox').first();
    await checkbox.tap();
    await checkbox.tap();

    await expect(
      page.getByTestId('calendar-week-day-ignored').first(),
    ).toBeVisible();
  });

  test('still opens the full day editor from a day of the month grid', async ({
    page,
    isMobile,
  }) => {
    await enterLocalMode(page);
    await page.goto('/calendar?day=2026-01-15');

    await expect(
      page.getByRole('button', { name: labels.backToCalendar }),
    ).toBeVisible();

    await page.getByRole('button', { name: labels.backToCalendar }).tap();
    await openMonthGrid(page, isMobile);

    await expect(page.locator('.calendar-day-cell')).toHaveCount(42);
  });

  test('expands icon control hit areas to the touch minimum', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');
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
    isMobile,
  }) => {
    await enterLocalMode(page);
    await openCalendarBulkCreate(page, isMobile);

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
    await page.getByRole('button', { name: labels.checklistEmpty }).tap();

    const input = firstChecklistInput(page);
    await input.fill('Mobile drag');
    await input.press('Enter');

    const dragHandle = page.locator('.tree-drag-handle').first();
    await expect(dragHandle).toBeVisible();
    await expect(dragHandle).toHaveCSS('touch-action', 'none');
  });

  test('pins the navigation bar to the bottom of the viewport', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');

    const navigation = page.locator('.app-bottom-nav');
    await expect(navigation).toBeVisible();

    const isPinned = await navigation.evaluate((element) => {
      const rect = element.getBoundingClientRect();

      return Math.abs(rect.bottom - window.innerHeight) < 1;
    });

    expect(isPinned).toBe(true);

    const goalsLink = page.getByRole('link', { name: labels.goalsLink });
    const box = await goalsLink.boundingBox();

    expect(box?.height).toBeGreaterThanOrEqual(36);
  });

  test('never hides the page content behind the navigation bar', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');
    await page.getByRole('button', { name: labels.checklistEmpty }).tap();

    const input = firstChecklistInput(page);
    await input.fill('Last task of the day');
    await input.press('Enter');

    await page.mouse.wheel(0, 2000);

    const overlap = await page.evaluate(() => {
      const navigation = document.querySelector('.app-bottom-nav');
      const main = document.querySelector('main');

      if (!navigation || !main) {
        return 0;
      }

      const style = window.getComputedStyle(main);

      return (
        navigation.getBoundingClientRect().height -
        Number.parseFloat(style.paddingBottom)
      );
    });

    expect(overlap).toBeLessThanOrEqual(0);
  });

  test('reaches every row action from the sheet', async ({ page }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');
    await page.getByRole('button', { name: labels.checklistEmpty }).tap();

    const input = firstChecklistInput(page);
    await input.fill('Task with actions');
    await input.press('Enter');

    await expect(
      page.getByRole('button', { name: /create subtask|criar subtarefa/i }),
    ).toHaveCount(0);

    await page
      .getByRole('button', { name: labels.rowExtraOptions })
      .first()
      .tap();

    const sheet = page.getByRole('dialog', { name: labels.rowExtraOptions });

    for (const action of [
      /create subtask|criar subtarefa/i,
      /move task up|mover tarefa para cima/i,
      /move task down|mover tarefa para baixo/i,
      /delete task|excluir tarefa/i,
    ]) {
      await expect(sheet.getByRole('button', { name: action })).toBeVisible();
    }
  });

  test('keeps a sheet below the full viewport height', async ({ page }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');
    await page.getByRole('button', { name: labels.calendarOptions }).tap();

    const sheet = page.getByRole('dialog', { name: labels.calendarOptions });
    await expect(sheet).toBeVisible();

    const fitsAboveTheFold = await sheet.evaluate(
      (element) =>
        element.getBoundingClientRect().height <= window.innerHeight * 0.9,
    );

    expect(fitsAboveTheFold).toBe(true);
  });

  test('keeps the goal category submenu inside the viewport', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.goto('/goals');
    await page.getByRole('button', { name: labels.createGoal }).tap();
    await page.waitForURL(/goal=/);
    await page
      .getByRole('button', {
        name: /back to goal groups|voltar para grupos de metas/i,
      })
      .tap();

    await page
      .getByRole('button', { name: /goal actions|ações da meta/i })
      .tap();
    await page
      .getByRole('button', { name: /^assign category$|^atribuir categoria$/i })
      .tap();

    const submenu = page.locator('[data-goal-category-submenu="true"]');
    await expect(submenu).toBeVisible();

    const box = await submenu.boundingBox();
    const viewportWidth = page.viewportSize()?.width ?? 0;

    expect(box?.x ?? 0).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      viewportWidth,
    );
  });

  test('reaches the goal actions from the sheet', async ({ page }) => {
    await enterLocalMode(page);
    await page.goto('/goals');
    await page.getByRole('button', { name: labels.createGoal }).tap();
    await page.waitForURL(/goal=/);

    await expect(
      page.getByRole('button', { name: /archive goal|arquivar meta/i }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: labels.moreOptions }).last().tap();

    await expect(
      page
        .getByRole('dialog', { name: labels.moreOptions })
        .getByRole('button', { name: /delete goal|excluir meta/i }),
    ).toBeVisible();
  });
});
