import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryAssignmentMenu } from '@/features/categories/category-assignment-menu';

const { useCategoryTagsMock } = vi.hoisted(() => ({
  useCategoryTagsMock: vi.fn(),
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    scope: {
      id: 'guest:test',
      kind: 'guest',
      ownerId: 'test',
    },
  }),
}));

vi.mock('@/features/categories/use-category-tags', () => ({
  useCategoryTags: useCategoryTagsMock,
}));

describe('CategoryAssignmentMenu', () => {
  beforeEach(() => {
    useCategoryTagsMock.mockReset();
    useCategoryTagsMock.mockReturnValue([
      {
        id: 'category-home',
        name: 'Home',
        colorHex: '#f59e0b',
        useOwnName: false,
      },
      {
        id: 'category-health',
        name: 'Health',
        colorHex: '#4b6f52',
        useOwnName: false,
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the menu in a portal outside the local container', async () => {
    const onAssign = vi.fn();
    const { container } = render(
      <div className="overflow-y-auto">
        <CategoryAssignmentMenu
          assignLabel="Assign category"
          clearLabel="Clear category"
          selectedCategoryTagId={null}
          surface="calendar"
          onAssign={onAssign}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Assign category' }));

    const optionButton = await screen.findByRole('button', { name: 'Home' });

    expect(container.contains(optionButton)).toBe(false);
    expect(optionButton.parentElement).toHaveClass('fixed');
    // The clear action no longer lives inside the selector menu, and it is
    // hidden while nothing is assigned.
    expect(
      screen.queryByRole('button', { name: 'Clear category' }),
    ).not.toBeInTheDocument();

    fireEvent.click(optionButton);

    await waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith('category-home');
    });
  });

  it('renders a clear button beside the trigger when a category is assigned', async () => {
    const onAssign = vi.fn();
    const { container } = render(
      <CategoryAssignmentMenu
        assignLabel="Assign category"
        clearLabel="Clear category"
        selectedCategoryTagId="category-home"
        surface="calendar"
        onAssign={onAssign}
      />,
    );

    const clearButton = screen.getByRole('button', { name: 'Clear category' });

    // The clear button renders next to the trigger, outside any portal menu.
    expect(container.contains(clearButton)).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Assign category' }).parentElement,
    ).toBe(clearButton.parentElement);

    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith(null);
    });
  });

  it('can expose clear category inside the menu for collective actions', async () => {
    const onAssign = vi.fn();

    render(
      <CategoryAssignmentMenu
        assignLabel="Assign category to selected"
        clearLabel="Clear category"
        selectedCategoryTagId={null}
        showClearInMenu
        surface="calendar"
        onAssign={onAssign}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Assign category to selected' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Clear category' }),
    );

    await waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith(null);
    });
  });

  it('never lists own-name categories and does not scroll or clamp height', async () => {
    useCategoryTagsMock.mockReturnValue([
      {
        id: 'category-named',
        name: 'Health',
        colorHex: '#4b6f52',
        useOwnName: false,
      },
      {
        id: 'category-own',
        name: '',
        colorHex: '#f59e0b',
        useOwnName: true,
      },
    ]);

    render(
      <CategoryAssignmentMenu
        assignLabel="Assign category"
        clearLabel="Clear category"
        selectedCategoryTagId="category-own"
        surface="goal_group"
        onAssign={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Assign category' }));

    const menu = (await screen.findByRole('button', { name: 'Health' }))
      .parentElement;

    expect(menu?.className).not.toMatch(/overflow-y-auto/);
    expect(menu?.className).not.toMatch(/max-h-/);
    // The own-name category assigned to this entity is never offered as an
    // option in the selector, and clear lives outside the menu.
    expect(menu?.querySelectorAll('button').length).toBe(1); // single named category
  });

  it('keeps the portal menu inside a narrow viewport', async () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 160,
    });

    render(
      <CategoryAssignmentMenu
        assignLabel="Assign category"
        clearLabel="Clear category"
        selectedCategoryTagId={null}
        surface="calendar"
        onAssign={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Assign category' });
    trigger.getBoundingClientRect = vi.fn(
      () =>
        ({
          bottom: 58,
          height: 40,
          left: 82,
          right: 122,
          top: 18,
          width: 40,
          x: 82,
          y: 18,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent.click(trigger);

    const menu = (await screen.findByRole('button', { name: 'Home' }))
      .parentElement;

    expect(menu).toHaveStyle({
      left: '16px',
      width: '128px',
    });
  });
});
