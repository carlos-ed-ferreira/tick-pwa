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
      },
      {
        id: 'category-health',
        name: 'Health',
        colorHex: '#4b6f52',
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
          onAssign={onAssign}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Assign category' }));

    const optionButton = await screen.findByRole('button', { name: 'Home' });

    expect(container.contains(optionButton)).toBe(false);
    expect(optionButton.parentElement).toHaveClass('fixed');

    fireEvent.click(optionButton);

    await waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith('category-home');
    });
  });
});
