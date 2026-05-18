import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryManager } from '@/features/categories';

const {
  createCategoryTagMock,
  reorderCategoryTagMock,
  softDeleteCategoryTagMock,
  updateCategoryTagMock,
  useCategoryTagsMock,
} = vi.hoisted(() => ({
  createCategoryTagMock: vi.fn().mockResolvedValue(undefined),
  reorderCategoryTagMock: vi.fn().mockResolvedValue(undefined),
  softDeleteCategoryTagMock: vi.fn().mockResolvedValue(undefined),
  updateCategoryTagMock: vi.fn().mockResolvedValue(undefined),
  useCategoryTagsMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  createCategoryTag: createCategoryTagMock,
  reorderCategoryTag: reorderCategoryTagMock,
  softDeleteCategoryTag: softDeleteCategoryTagMock,
  updateCategoryTag: updateCategoryTagMock,
}));

vi.mock('@/providers', () => ({
  useAppContext: () => ({
    dictionary: {
      dayEditor: {
        addCategory: 'Add category',
        assignCategory: 'Assign category',
        categoryNamePlaceholder: 'Category name',
        deleteCategory: 'Delete category',
        moveCategoryDown: 'Move category down',
        moveCategoryUp: 'Move category up',
        newCategory: 'New category',
      },
    },
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

describe('CategoryManager', () => {
  beforeEach(() => {
    createCategoryTagMock.mockClear();
    reorderCategoryTagMock.mockClear();
    softDeleteCategoryTagMock.mockClear();
    updateCategoryTagMock.mockClear();
    useCategoryTagsMock.mockReset();
    useCategoryTagsMock.mockReturnValue([
      {
        id: 'category-1',
        name: 'HOME',
        colorHex: '#71717a',
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('preserves accent composition and commits uppercase text on blur', async () => {
    render(<CategoryManager />);

    const input = screen.getByLabelText('Category name');

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'matemática' } });

    expect(input).toHaveValue('matemática');
    expect(updateCategoryTagMock).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);

    expect(input).toHaveValue('MATEMÁTICA');

    fireEvent.blur(input);

    await waitFor(() => {
      expect(updateCategoryTagMock).toHaveBeenCalledWith({
        scope: {
          id: 'guest:test',
          kind: 'guest',
          ownerId: 'test',
        },
        categoryTagId: 'category-1',
        name: 'MATEMÁTICA',
      });
    });
  });

  it('allows clearing the field while editing and restores on blur when left empty', async () => {
    render(<CategoryManager />);

    const input = screen.getByLabelText('Category name');

    fireEvent.change(input, { target: { value: '' } });

    expect(input).toHaveValue('');
    expect(updateCategoryTagMock).not.toHaveBeenCalled();

    fireEvent.blur(input);

    await waitFor(() => {
      expect(input).toHaveValue('HOME');
    });
    expect(updateCategoryTagMock).not.toHaveBeenCalled();
  });

  it('forces uppercase while typing outside composition', () => {
    render(<CategoryManager />);

    const input = screen.getByLabelText('Category name');

    fireEvent.change(input, { target: { value: 'saude' } });

    expect(input).toHaveValue('SAUDE');
  });
});
