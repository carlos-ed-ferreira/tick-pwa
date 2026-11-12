import { expect, test } from '@playwright/test';
import {
  enterLocalMode,
  firstChecklistInput,
  firstGoalStepInput,
  labels,
  openMonthGrid,
} from './helpers';

test.describe('mobile layout', () => {
  test.skip(({ isMobile }) => !isMobile, 'covers the touch composition only');

  test('never scrolls the page horizontally', async ({ page }) => {
    await enterLocalMode(page);

    for (const path of ['/calendar', '/goals', '/recurring']) {
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

  test('keeps short task and step text beside completion and actions across touch widths', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.getByRole('button', { name: labels.checklistEmpty }).tap();
    await firstChecklistInput(page).fill('Read a chapter');
    await firstChecklistInput(page).press('Enter');

    const assertCompactRow = async (attribute: string) => {
      const row = page
        .locator('[data-tree-row]')
        .filter({ has: page.locator(`[${attribute}="true"]`) })
        .first();
      await expect(row.locator(`[${attribute}="true"]`)).toHaveValue(
        'Read a chapter',
      );
      const geometry = await row.evaluate((element) => {
        const text = element.querySelector('textarea')!.getBoundingClientRect();
        const checkbox = element
          .querySelector('input[type="checkbox"]')!
          .getBoundingClientRect();
        const bounds = element.getBoundingClientRect();
        return {
          height: bounds.height,
          textCenter: text.y + text.height / 2,
          checkboxCenter: checkbox.y + checkbox.height / 2,
        };
      });
      expect(geometry.height).toBeLessThanOrEqual(64);
      expect(
        Math.abs(geometry.textCenter - geometry.checkboxCenter),
      ).toBeLessThanOrEqual(2);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    };

    for (const width of [320, 360, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 915 });
      await assertCompactRow('data-checklist-input');
    }

    await page.getByRole('link', { name: labels.goalsLink }).tap();
    await page.getByRole('button', { name: labels.createGoal }).first().tap();
    await page.getByRole('button', { name: labels.goalStepEmpty }).tap();
    await firstGoalStepInput(page).fill('Read a chapter');
    await firstGoalStepInput(page).press('Enter');
    for (const width of [320, 360, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 915 });
      await assertCompactRow('data-goal-step-input');
    }
  });

  test('wraps long task titles without pushing controls or losing content', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await enterLocalMode(page);
    await page.getByRole('button', { name: labels.checklistEmpty }).tap();
    const title =
      'Prepare a detailed presentation with references, examples and next steps for the community project';
    await firstChecklistInput(page).fill(title);
    await firstChecklistInput(page).press('Enter');
    const input = firstChecklistInput(page);
    await expect(input).toHaveValue(title);
    const size = await input.evaluate((element) => ({
      height: element.clientHeight,
      content: element.scrollHeight,
    }));
    expect(size.height).toBeGreaterThan(24);
    expect(size.content).toBeLessThanOrEqual(size.height + 1);
    await page.getByRole('checkbox').first().tap();
    await expect(page.getByRole('checkbox').first()).toBeChecked();
    await page.reload();
    await expect(firstChecklistInput(page)).toHaveValue(title);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

  test('keeps category actions aligned and preference labels inside their buttons', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.getByRole('button', { name: labels.checklistEmpty }).tap();
    await firstChecklistInput(page).fill('Plan the week');
    await firstChecklistInput(page).press('Enter');
    for (const width of [320, 412, 768]) {
      await page.setViewportSize({ width, height: 915 });
      const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
      await expect(signIn.locator('span')).toBeVisible();
      const categories = page.getByRole('button', { name: labels.categories });
      const aligned = await categories.evaluate((button) => {
        const parent = button.parentElement!.getBoundingClientRect();
        return (
          Math.abs(button.getBoundingClientRect().right - parent.right) <= 1
        );
      });
      expect(aligned).toBe(true);
      await page
        .getByRole('button', { name: labels.configureTaskPreferences })
        .tap();
      const radios = page
        .getByRole('radiogroup', { name: 'Task view', exact: true })
        .getByRole('radio');
      await expect(radios).toHaveCount(2);
      for (const radio of await radios.all()) {
        expect(
          await radio.evaluate(
            (button) =>
              button.scrollWidth <= button.clientWidth &&
              button.scrollHeight <= button.clientHeight,
          ),
        ).toBe(true);
      }
      await page.keyboard.press('Escape');
    }
    await page.goto('/goals');
    const categories = page.getByRole('button', { name: labels.categories });
    expect(
      await categories.evaluate(
        (button) =>
          Math.abs(
            button.getBoundingClientRect().right -
              button.parentElement!.getBoundingClientRect().right,
          ) <= 1,
      ),
    ).toBe(true);
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

  test('keeps long task text between completion and actions', async ({
    page,
  }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');

    await page.getByRole('button', { name: labels.checklistEmpty }).tap();

    const input = firstChecklistInput(page);
    await input.fill('Equilibrio quimico com um titulo bastante longo');

    const row = page.locator('[data-tree-row]').first();
    const field = row.locator('[data-task-text-field]').first();
    const rowBox = await row.boundingBox();
    const fieldBox = await field.boundingBox();

    expect(rowBox).not.toBeNull();
    expect(fieldBox).not.toBeNull();
    const checkboxBox = await row.getByRole('checkbox').boundingBox();
    const menuBox = await row
      .getByRole('button', { name: labels.rowExtraOptions })
      .boundingBox();
    expect(checkboxBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(fieldBox!.width).toBeGreaterThan(rowBox!.width * 0.65);
    expect(checkboxBox!.x + checkboxBox!.width).toBeLessThanOrEqual(
      fieldBox!.x,
    );
    expect(fieldBox!.x + fieldBox!.width).toBeLessThanOrEqual(menuBox!.x + 1);
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
  }) => {
    await enterLocalMode(page);
    await page.goto('/calendar');

    const position = await page.evaluate(() => {
      const probe = document.createElement('button');
      probe.className = 'touch-target absolute';
      document.body.append(probe);
      const computedPosition = getComputedStyle(probe).position;
      probe.remove();
      return computedPosition;
    });

    expect(position).toBe('absolute');
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

    await page
      .getByRole('button', { name: labels.rowExtraOptions })
      .first()
      .tap();
    await page
      .getByRole('button', { name: /^(drag task|arrastar tarefa)$/i })
      .tap();
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

  test('keeps the three navigation items on one line on a narrow phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await enterLocalMode(page);
    await page.goto('/recurring');

    const navigation = page.locator('.app-bottom-nav');
    const links = navigation.getByRole('link');
    await expect(links).toHaveCount(3);

    const navigationBox = await navigation.boundingBox();
    const boxes = await links.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();

        return {
          bottom: rect.bottom,
          fits:
            element.scrollWidth <= element.clientWidth &&
            getComputedStyle(element).whiteSpace === 'nowrap',
          right: rect.right,
          top: rect.top,
        };
      }),
    );

    for (const box of boxes) {
      expect(box.fits).toBe(true);
      expect(box.right).toBeLessThanOrEqual(360);
      expect(box.top).toBeGreaterThanOrEqual(navigationBox?.y ?? 0);
      expect(box.bottom).toBeLessThanOrEqual(
        (navigationBox?.y ?? 0) + (navigationBox?.height ?? 0),
      );
    }
    expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1);
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
        name: /^back$|^voltar$/i,
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
