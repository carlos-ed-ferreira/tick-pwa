import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGuestScope } from '@/lib/domain';
import type { BulkChecklistDraftItem } from '@/features/calendar/bulk-checklist-draft';
import {
  RecurringChildrenEditor,
  createChildRowHandlers,
} from '@/features/recurring/recurring-children-editor';
import { childrenToDraftItems } from '@/features/recurring/recurrence-form';
import { getDictionary } from '@/lib/i18n/dictionaries';

const dictionary = getDictionary('en');
const scope = createGuestScope('children-editor');

vi.mock('@/providers', () => ({
  useAppContext: () => ({ dictionary, locale: 'en', scope }),
}));

function createItems(): BulkChecklistDraftItem[] {
  return childrenToDraftItems([
    {
      id: 'a',
      parentId: null,
      text: 'First',
      bold: false,
      priority: false,
      sortRank: 'a0',
    },
    {
      id: 'b',
      parentId: null,
      text: 'Second',
      bold: false,
      priority: false,
      sortRank: 'a1',
    },
  ]);
}

function createHarness(itemId = 'b', parentId: string | null = null) {
  let items = createItems();
  const handlers = createChildRowHandlers(itemId, parentId, (update) => {
    items = typeof update === 'function' ? update(items) : update;
  });

  return {
    handlers,
    item: (id: string) => items.find((item) => item.id === id),
    items: () => items,
  };
}

describe('createChildRowHandlers', () => {
  it('creates a child and returns its id for focus', () => {
    const { handlers, item } = createHarness('a');
    const id = handlers.onCreateChild();

    expect(item(id)?.parentId).toBe('a');
  });

  it('creates a sibling after the row', () => {
    const { handlers, item } = createHarness('a');
    const id = handlers.onCreateSibling();

    expect(item(id)?.parentId).toBeNull();
    expect(item(id)!.sortRank > item('a')!.sortRank).toBe(true);
    expect(item(id)!.sortRank < item('b')!.sortRank).toBe(true);
  });

  it('edits the text and the formatting', () => {
    const { handlers, item } = createHarness();

    handlers.onTextChange('Typed');
    expect(item('b')?.text).toBe('Typed');
    handlers.onSaveText('Saved');
    expect(item('b')?.text).toBe('Saved');
    handlers.onToggleBold();
    expect(item('b')?.bold).toBe(true);
    handlers.onTogglePriority();
    expect(item('b')?.priority).toBe(true);
    handlers.onToggleCollapsed();
    expect(item('b')?.collapsed).toBe(true);
  });

  it('indents and outdents the row', () => {
    const { handlers, item } = createHarness();

    handlers.onIndent();
    expect(item('b')?.parentId).toBe('a');
    handlers.onOutdent();
    expect(item('b')?.parentId).toBeNull();
  });

  it('reorders the row', () => {
    const { handlers, item } = createHarness();

    handlers.onMoveUp();
    expect(item('b')!.sortRank < item('a')!.sortRank).toBe(true);
    handlers.onMoveDown();
    expect(item('b')!.sortRank > item('a')!.sortRank).toBe(true);
  });

  it('moves the row to another position or parent', () => {
    const { handlers, item } = createHarness();

    handlers.onMoveTo({ itemId: 'b', placement: 'child', targetItemId: 'a' });
    expect(item('b')?.parentId).toBe('a');
    handlers.onMoveTo({ itemId: 'b', placement: 'before', targetItemId: 'a' });
    expect(item('b')?.parentId).toBeNull();
    expect(item('b')!.sortRank < item('a')!.sortRank).toBe(true);
  });

  it('deletes the row', () => {
    const { handlers, items } = createHarness();

    handlers.onDelete();
    expect(items().map((item) => item.id)).toEqual(['a']);
  });
});

function Editor({ initial }: { initial: BulkChecklistDraftItem[] }) {
  const [items, setItems] = useState(initial);

  return <RecurringChildrenEditor items={items} setItems={setItems} />;
}

describe('RecurringChildrenEditor', () => {
  afterEach(cleanup);

  it('starts empty and adds the first subtask', () => {
    render(<Editor initial={[]} />);

    fireEvent.click(
      screen.getByRole('button', { name: dictionary.recurring.childrenEmpty }),
    );

    expect(
      document.querySelectorAll('[data-recurrence-child-input="true"]'),
    ).toHaveLength(1);
  });

  it('edits structure only, without completion, selection or category', () => {
    render(<Editor initial={createItems()} />);

    expect(
      document.querySelectorAll('[data-recurrence-child-input="true"]'),
    ).toHaveLength(2);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(
      screen.queryByRole('button', { name: dictionary.dayEditor.toggleItem }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: dictionary.dayEditor.selectItem }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: dictionary.dayEditor.assignCategory,
      }),
    ).toBeNull();
  });
});
