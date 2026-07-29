import { expect, test } from '@playwright/test';
import { enterLocalMode, firstGoalStepInput, labels } from './helpers';

test('persists a goal checklist item in local mode', async ({ page }) => {
  await enterLocalMode(page);
  await page.goto('/goals');
  await page.getByRole('button', { name: labels.createGoal }).click();
  await page.waitForURL(/\/goals\?goal=.+/);

  await page.getByRole('button', { name: labels.goalStepEmpty }).click();

  const itemInput = firstGoalStepInput(page);
  await itemInput.fill('Define integration coverage');
  await itemInput.press('Enter');

  await expect(page.locator('[data-goal-step-input="true"]')).toHaveCount(2);
  await expect(
    page.locator('[data-goal-step-input="true"]').nth(1),
  ).toBeFocused();

  const firstCheckbox = page.getByRole('checkbox').first();
  await firstCheckbox.click();
  await expect(firstCheckbox).toBeChecked();

  await page.reload();
  await expect(firstGoalStepInput(page)).toHaveValue(
    'Define integration coverage',
  );

  await page.goBack();
  await expect(
    page.getByRole('button', { name: labels.createGoal }).first(),
  ).toBeVisible();
});

test('caps a long goal title without deforming the back button or overflowing the page', async ({
  page,
}) => {
  await enterLocalMode(page);
  await page.goto('/goals');
  await page.getByRole('button', { name: labels.createGoal }).click();
  await page.waitForURL(/\/goals\?goal=.+/);

  const backButton = page.getByRole('button', {
    name: /back to goal groups|voltar para grupos de metas/i,
  });
  const initialButtonBox = await backButton.boundingBox();

  await page
    .getByRole('textbox', { name: /rename goal|renomear meta/i })
    .fill('X'.repeat(300));

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  const finalButtonBox = await backButton.boundingBox();

  expect(overflow).toBe(0);
  expect(initialButtonBox).not.toBeNull();
  expect(finalButtonBox).not.toBeNull();
  expect(finalButtonBox?.width).toBeCloseTo(initialButtonBox?.width ?? 0, 0);
  expect(finalButtonBox?.height).toBeCloseTo(initialButtonBox?.height ?? 0, 0);
});

test('aligns the goal category submenu with its hovered action', async ({
  page,
}) => {
  await enterLocalMode(page);
  await page.goto('/goals');
  await page.getByRole('button', { name: labels.createGoal }).click();
  await page.waitForURL(/\/goals\?goal=.+/);
  await page
    .getByRole('button', {
      name: /back to goal groups|voltar para grupos de metas/i,
    })
    .click();

  await page
    .getByRole('button', { name: /goal actions|ações da meta/i })
    .click();

  const categoryAction = page.getByRole('button', {
    name: /^assign category$|^atribuir categoria$/i,
  });
  const actionsMenu = page.locator('[data-goal-actions-menu="true"]');
  const submenu = page.locator('[data-goal-category-submenu="true"]');

  await expect(submenu).toHaveCount(0);
  await categoryAction.hover();
  await expect(submenu).toBeVisible();

  const horizontalOverflow = await actionsMenu.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  expect(horizontalOverflow).toBe(0);

  const scrollbarStyle = await actionsMenu.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      color: style.scrollbarColor,
      width: style.scrollbarWidth,
    };
  });
  expect(scrollbarStyle.width).toBe('thin');
  expect(scrollbarStyle.color).not.toBe('auto');

  const actionBox = await categoryAction.boundingBox();
  const actionsMenuBox = await actionsMenu.boundingBox();
  const submenuBox = await submenu.boundingBox();
  const radii = await submenu.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      bottomLeft: style.borderBottomLeftRadius,
      topLeft: style.borderTopLeftRadius,
    };
  });
  const joinedSurfaceStyles = await submenu.evaluate((element) => {
    const panelStyle = window.getComputedStyle(element);
    const backdropStyle = window.getComputedStyle(element, '::before');
    const mainStyle = window.getComputedStyle(
      document.querySelector('[data-goal-actions-menu="true"]')!,
    );

    return {
      mainClipPath: mainStyle.clipPath,
      panelBackdropFilter: panelStyle.backdropFilter,
      panelZIndex: panelStyle.zIndex,
      sampledBackdropFilter: backdropStyle.backdropFilter,
      sampledBackdropClipPath: backdropStyle.clipPath,
      sampledBackdropLeft: backdropStyle.left,
    };
  });

  expect(actionBox).not.toBeNull();
  expect(actionsMenuBox).not.toBeNull();
  expect(submenuBox).not.toBeNull();
  expect(submenuBox?.x).toBeCloseTo(
    (actionsMenuBox?.x ?? 0) + (actionsMenuBox?.width ?? 0) - 1,
    0,
  );
  expect(submenuBox?.x ?? 0).toBeGreaterThanOrEqual(
    (actionBox?.x ?? 0) + (actionBox?.width ?? 0),
  );
  expect((submenuBox?.y ?? 0) + (submenuBox?.height ?? 0) / 2).toBeCloseTo(
    (actionBox?.y ?? 0) + (actionBox?.height ?? 0) / 2,
    0,
  );
  expect(radii).toEqual({ bottomLeft: '0px', topLeft: '0px' });
  expect(joinedSurfaceStyles.mainClipPath).not.toBe('none');
  expect(joinedSurfaceStyles.panelBackdropFilter).toBe('none');
  expect(joinedSurfaceStyles.panelZIndex).toBe('50');
  expect(joinedSurfaceStyles.sampledBackdropFilter).toBe('blur(14px)');
  expect(joinedSurfaceStyles.sampledBackdropClipPath).not.toBe('none');
  expect(joinedSurfaceStyles.sampledBackdropLeft).toBe('-32px');

  await submenu.hover();
  await expect(submenu).toBeVisible();
  await page
    .getByRole('button', { name: /archive goal|arquivar meta/i })
    .hover();
  await expect(submenu).toHaveCount(0);
});
