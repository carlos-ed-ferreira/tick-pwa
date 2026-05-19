'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  IndentDecrease,
  IndentIncrease,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import {
  Button,
  Checkbox,
  ConfirmationDialog,
  IconButton,
} from '@/components/ui';
import { CategoryAssignmentMenu, useCategoryTags } from '@/features/categories';
import {
  assignChecklistItemCategory,
  createChecklistChild,
  createChecklistItem,
  indentChecklistItem,
  outdentChecklistItem,
  reorderChecklistItem,
  softDeleteChecklistItem,
  toggleChecklistItemChecked,
  toggleChecklistItemCollapsed,
  toggleChecklistItemPriority,
  updateChecklistItemText,
} from '@/lib/db';
import { requiresDeleteConfirmation } from '@/lib/confirm-delete';
import { useAppContext } from '@/providers';
import type { VisibleChecklistRow } from './checklist-tree';
import { useChecklistTree } from './use-checklist-tree';

const checklistInputSelector = '[data-checklist-input="true"]';

function toAlphaColor(hex: string, opacity: number): string {
  const normalizedHex = hex.replace('#', '');

  if (normalizedHex.length !== 3 && normalizedHex.length !== 6) {
    return hex;
  }

  const expandedHex =
    normalizedHex.length === 3
      ? normalizedHex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : normalizedHex;
  const red = Number.parseInt(expandedHex.slice(0, 2), 16);
  const green = Number.parseInt(expandedHex.slice(2, 4), 16);
  const blue = Number.parseInt(expandedHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function ChecklistSurface({ dailyEntryId }: { dailyEntryId: string }) {
  const { dictionary, scope } = useAppContext();
  const rows = useChecklistTree(scope, dailyEntryId);
  const categoryTags = useCategoryTags(scope);
  const categoryTagMap = new Map(categoryTags.map((tag) => [tag.id, tag]));

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
                categoryTagMap={categoryTagMap}
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
  categoryTagMap,
  dailyEntryId,
  row,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  dailyEntryId: string;
  row: VisibleChecklistRow;
}) {
  const { dictionary, scope } = useAppContext();
  const { item, depth, hasChildren, isFirstSibling, isLastSibling } = row;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [text, setText] = useState(item.text);
  const selectedCategory = item.categoryTagId
    ? (categoryTagMap.get(item.categoryTagId) ?? null)
    : null;

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

  const deleteItem = useCallback(async () => {
    if (!scope) {
      return;
    }

    if (requiresDeleteConfirmation(text)) {
      setIsDeleteDialogOpen(true);
      return;
    }

    await softDeleteChecklistItem({ scope, itemId: item.id });
  }, [item.id, scope, text]);

  const confirmDeleteItem = useCallback(async () => {
    if (!scope) {
      return;
    }

    setIsDeleteDialogOpen(false);
    await softDeleteChecklistItem({ scope, itemId: item.id });
  }, [item.id, scope]);

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
      const checklistInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(checklistInputSelector),
      );
      const currentIndex = checklistInputs.indexOf(event.currentTarget);
      const targetInput =
        checklistInputs[currentIndex + (event.shiftKey ? -1 : 1)];

      if (!targetInput) {
        return;
      }

      event.preventDefault();
      await flushText();

      window.requestAnimationFrame(() => {
        targetInput.focus();
        const caretPosition = targetInput.value.length;
        targetInput.setSelectionRange(caretPosition, caretPosition);
      });
      return;
    }

    if (event.key === 'Backspace' && text.length === 0) {
      event.preventDefault();
      await softDeleteChecklistItem({ scope, itemId: item.id });
    }
  }

  return (
    <>
      <div
        className="group flex min-w-0 items-center gap-1 rounded-md px-1 py-1 transition hover:bg-surface"
        style={{
          paddingLeft: `min(${depth * 16}px, 56px)`,
          backgroundColor: selectedCategory
            ? toAlphaColor(selectedCategory.colorHex, 0.12)
            : undefined,
          boxShadow: item.priority
            ? 'inset 3px 0 0 0 rgba(245, 158, 11, 0.9)'
            : undefined,
        }}
      >
        <IconButton
          aria-label={
            item.collapsed
              ? dictionary.dayEditor.expandItem
              : dictionary.dayEditor.collapseItem
          }
          className={!hasChildren ? 'disabled:opacity-100' : ''}
          disabled={!hasChildren}
          onClick={() => {
            if (scope) {
              void toggleChecklistItemCollapsed({ scope, itemId: item.id });
            }
          }}
        >
          {item.collapsed || !hasChildren ? (
            <ChevronRight
              aria-hidden="true"
              className={`size-4 ${hasChildren ? '' : 'opacity-45'}`}
            />
          ) : (
            <ChevronDown aria-hidden="true" className="size-4" />
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
          data-checklist-input="true"
          spellCheck={false}
          value={text}
          placeholder={dictionary.dayEditor.itemPlaceholder}
          className={`min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-sm outline-none transition focus:bg-surface focus:shadow-sm ${
            item.checked ? 'opacity-50' : 'text-foreground'
          }`}
          onBlur={() => void flushText()}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => void handleKeyDown(event)}
        />

        {selectedCategory ? (
          <span
            className="shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium leading-none"
            style={{
              borderColor: selectedCategory.colorHex,
              backgroundColor: toAlphaColor(selectedCategory.colorHex, 0.18),
              color: selectedCategory.colorHex,
            }}
          >
            {selectedCategory.name}
          </span>
        ) : null}

        <div className="flex shrink-0 items-center gap-0">
          <IconButton
            aria-label={
              item.priority
                ? dictionary.dayEditor.unmarkPriority
                : dictionary.dayEditor.markPriority
            }
            onClick={() => {
              if (scope) {
                void toggleChecklistItemPriority({ scope, itemId: item.id });
              }
            }}
          >
            <Star
              aria-hidden="true"
              className={`size-4 ${item.priority ? 'fill-current text-amber-500' : 'opacity-60'}`}
            />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.moveItemUp}
            disabled={isFirstSibling}
            onClick={() => {
              if (scope) {
                void reorderChecklistItem({
                  scope,
                  itemId: item.id,
                  direction: 'up',
                });
              }
            }}
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.moveItemDown}
            disabled={isLastSibling}
            onClick={() => {
              if (scope) {
                void reorderChecklistItem({
                  scope,
                  itemId: item.id,
                  direction: 'down',
                });
              }
            }}
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </IconButton>
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
          <CategoryAssignmentMenu
            assignLabel={dictionary.dayEditor.assignCategory}
            clearLabel={dictionary.dayEditor.clearCategory}
            selectedCategoryTagId={item.categoryTagId}
            onAssign={(categoryTagId) => {
              if (scope) {
                return assignChecklistItemCategory({
                  scope,
                  itemId: item.id,
                  categoryTagId,
                });
              }

              return Promise.resolve();
            }}
          />
          <IconButton
            aria-label={dictionary.dayEditor.deleteItem}
            onClick={() => void deleteItem()}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
      </div>

      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmLabel={dictionary.actions.delete}
        description={dictionary.dayEditor.confirmDeleteItem}
        open={isDeleteDialogOpen}
        title={dictionary.dayEditor.deleteItem}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => void confirmDeleteItem()}
      />
    </>
  );
}
