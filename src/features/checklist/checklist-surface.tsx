'use client';

import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  IndentDecrease,
  IndentIncrease,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Button, Checkbox, IconButton } from '@/components/ui';
import {
  createChecklistChild,
  createChecklistItem,
  indentChecklistItem,
  outdentChecklistItem,
  softDeleteChecklistItem,
  toggleChecklistItemChecked,
  toggleChecklistItemCollapsed,
  updateChecklistItemText,
} from '@/lib/db';
import { useAppContext } from '@/providers';
import type { VisibleChecklistRow } from './checklist-tree';
import { useChecklistTree } from './use-checklist-tree';

export function ChecklistSurface({ dailyEntryId }: { dailyEntryId: string }) {
  const { dictionary, scope } = useAppContext();
  const rows = useChecklistTree(scope, dailyEntryId);

  const createRootItem = useCallback(async () => {
    if (!scope) {
      return;
    }

    await createChecklistItem({ scope, dailyEntryId });
  }, [dailyEntryId, scope]);

  if (!scope) {
    return null;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted">
          {dictionary.dayEditor.checklist}
        </h3>
        <Button className="min-h-9 px-2" onClick={createRootItem}>
          <Plus aria-hidden="true" className="size-4" />
          {dictionary.dayEditor.addItem}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-background/50 p-2">
        {rows.length === 0 ? (
          <button
            type="button"
            className="flex min-h-32 w-full items-center justify-center rounded-md border border-dashed border-border px-4 text-sm text-muted transition hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            onClick={createRootItem}
          >
            {dictionary.dayEditor.emptyChecklist}
          </button>
        ) : (
          <div className="grid gap-1">
            {rows.map((row) => (
              <ChecklistRow
                key={row.item.id}
                dailyEntryId={dailyEntryId}
                row={row}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ChecklistRow({
  dailyEntryId,
  row,
}: {
  dailyEntryId: string;
  row: VisibleChecklistRow;
}) {
  const { dictionary, scope } = useAppContext();
  const { item, depth, hasChildren } = row;
  const [text, setText] = useState(item.text);

  const flushText = useCallback(async () => {
    if (!scope || text === item.text) {
      return;
    }

    await updateChecklistItemText({ scope, itemId: item.id, text });
  }, [item.id, item.text, scope, text]);

  useEffect(() => {
    if (!scope || text === item.text) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void updateChecklistItemText({ scope, itemId: item.id, text });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [item.id, item.text, scope, text]);

  const createSibling = useCallback(async () => {
    if (!scope) {
      return;
    }

    await flushText();
    await createChecklistItem({
      scope,
      dailyEntryId,
      parentId: item.parentId,
      afterItemId: item.id,
    });
  }, [dailyEntryId, flushText, item.id, item.parentId, scope]);

  const createChild = useCallback(async () => {
    if (!scope) {
      return;
    }

    await flushText();
    await createChecklistChild({ scope, dailyEntryId, parentItemId: item.id });
  }, [dailyEntryId, flushText, item.id, scope]);

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!scope) {
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      await toggleChecklistItemChecked({ scope, itemId: item.id });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      await createSibling();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      await flushText();

      if (event.shiftKey) {
        await outdentChecklistItem({ scope, itemId: item.id });
      } else {
        await indentChecklistItem({ scope, itemId: item.id });
      }
      return;
    }

    if (event.key === 'Backspace' && text.length === 0) {
      event.preventDefault();
      await softDeleteChecklistItem({ scope, itemId: item.id });
    }
  }

  return (
    <div
      className="group flex min-w-0 items-center gap-1 rounded-md px-1 py-1 transition hover:bg-surface"
      style={{ paddingLeft: `min(${depth * 16}px, 56px)` }}
    >
      <IconButton
        aria-label={
          item.collapsed
            ? dictionary.dayEditor.expandItem
            : dictionary.dayEditor.collapseItem
        }
        disabled={!hasChildren}
        onClick={() => {
          if (scope) {
            void toggleChecklistItemCollapsed({ scope, itemId: item.id });
          }
        }}
      >
        {hasChildren ? (
          item.collapsed ? (
            <ChevronRight aria-hidden="true" className="size-4" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-4" />
          )
        ) : (
          <CornerDownRight aria-hidden="true" className="size-4 opacity-0" />
        )}
      </IconButton>

      <Checkbox
        aria-label={dictionary.dayEditor.toggleItem}
        checked={item.checked}
        onChange={() => {
          if (scope) {
            void toggleChecklistItemChecked({ scope, itemId: item.id });
          }
        }}
      />

      <input
        value={text}
        placeholder={dictionary.dayEditor.itemPlaceholder}
        className={`min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-sm outline-none transition focus:bg-surface focus:shadow-sm ${
          item.checked ? 'text-muted line-through' : 'text-foreground'
        }`}
        onBlur={() => void flushText()}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => void handleKeyDown(event)}
      />

      <div className="flex shrink-0 items-center gap-0 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <IconButton
          aria-label={dictionary.dayEditor.addChild}
          onClick={createChild}
        >
          <Plus aria-hidden="true" className="size-4" />
        </IconButton>
        <IconButton
          aria-label={dictionary.dayEditor.indentItem}
          onClick={() => {
            if (scope) {
              void indentChecklistItem({ scope, itemId: item.id });
            }
          }}
        >
          <IndentIncrease aria-hidden="true" className="size-4" />
        </IconButton>
        <IconButton
          aria-label={dictionary.dayEditor.outdentItem}
          onClick={() => {
            if (scope) {
              void outdentChecklistItem({ scope, itemId: item.id });
            }
          }}
        >
          <IndentDecrease aria-hidden="true" className="size-4" />
        </IconButton>
        <IconButton
          aria-label={dictionary.dayEditor.deleteItem}
          onClick={() => {
            if (scope) {
              void softDeleteChecklistItem({ scope, itemId: item.id });
            }
          }}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}
