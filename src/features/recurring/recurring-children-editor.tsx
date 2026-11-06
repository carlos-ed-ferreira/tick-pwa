'use client';

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { TaskTreeEditableRow, TreeListPanel } from '@/components/app';
import { createId } from '@/lib/domain';
import {
  buildVisibleBulkChecklistDraftRows,
  createBulkChecklistDraftChild,
  createBulkChecklistDraftItem,
  deleteBulkChecklistDraftItem,
  indentBulkChecklistDraftItem,
  moveBulkChecklistDraftItemToParent,
  moveBulkChecklistDraftItemToTarget,
  outdentBulkChecklistDraftItem,
  reorderBulkChecklistDraftItem,
  toggleBulkChecklistDraftItemBold,
  toggleBulkChecklistDraftItemCollapsed,
  toggleBulkChecklistDraftItemPriority,
  updateBulkChecklistDraftItemText,
  type BulkChecklistDraftItem,
  type VisibleBulkChecklistDraftRow,
} from '@/features/calendar/bulk-checklist-draft';
import { useAppContext } from '@/providers';

const childInputSelector = '[data-recurrence-child-input="true"]';
const emptyCategoryMap = new Map<string, { colorHex: string; name: string }>();

function noop() {}

type DraftSetter = Dispatch<SetStateAction<BulkChecklistDraftItem[]>>;

export function createChildRowHandlers(
  itemId: string,
  parentId: string | null,
  setItems: DraftSetter,
) {
  function createAndFocus(
    create: (
      items: BulkChecklistDraftItem[],
      id: string,
    ) => BulkChecklistDraftItem[],
  ) {
    const id = createId();

    setItems((items) => create(items, id));

    return id;
  }

  function saveText(text: string) {
    setItems((items) => updateBulkChecklistDraftItemText(items, itemId, text));
  }

  return {
    onCreateChild: () =>
      createAndFocus((items, id) =>
        createBulkChecklistDraftChild(items, itemId, id),
      ),
    onCreateSibling: () =>
      createAndFocus((items, id) =>
        createBulkChecklistDraftItem(items, {
          id,
          parentId,
          afterItemId: itemId,
        }),
      ),
    onDelete: () =>
      setItems((items) => deleteBulkChecklistDraftItem(items, itemId)),
    onIndent: () =>
      setItems((items) => indentBulkChecklistDraftItem(items, itemId)),
    onMoveDown: () =>
      setItems((items) => reorderBulkChecklistDraftItem(items, itemId, 'down')),
    onMoveTo: ({
      itemId: movedItemId,
      placement,
      targetItemId,
    }: {
      itemId: string;
      placement: 'before' | 'child' | 'after';
      targetItemId: string;
    }) =>
      setItems((items) =>
        placement === 'child'
          ? moveBulkChecklistDraftItemToParent(items, movedItemId, targetItemId)
          : moveBulkChecklistDraftItemToTarget(
              items,
              movedItemId,
              targetItemId,
              placement,
            ),
      ),
    onMoveUp: () =>
      setItems((items) => reorderBulkChecklistDraftItem(items, itemId, 'up')),
    onOutdent: () =>
      setItems((items) => outdentBulkChecklistDraftItem(items, itemId)),
    onSaveText: saveText,
    onTextChange: saveText,
    onToggleBold: () =>
      setItems((items) => toggleBulkChecklistDraftItemBold(items, itemId)),
    onToggleCollapsed: () =>
      setItems((items) => toggleBulkChecklistDraftItemCollapsed(items, itemId)),
    onTogglePriority: () =>
      setItems((items) => toggleBulkChecklistDraftItemPriority(items, itemId)),
  };
}

function RecurringChildRow({
  row,
  rows,
  setItems,
}: {
  row: VisibleBulkChecklistDraftRow;
  rows: VisibleBulkChecklistDraftRow[];
  setItems: DraftSetter;
}) {
  const { dictionary } = useAppContext();
  const { depth, hasChildren, item } = row;
  const siblingIds = rows
    .filter((current) => current.item.parentId === item.parentId)
    .map((current) => current.item.id);
  const siblingIndex = siblingIds.indexOf(item.id);

  return (
    <TaskTreeEditableRow
      {...createChildRowHandlers(item.id, item.parentId, setItems)}
      structureOnly
      isDraft
      bold={item.bold}
      categoryTagId={null}
      categoryTagMap={emptyCategoryMap}
      checked={false}
      collapsed={item.collapsed}
      depth={depth}
      hasChildren={hasChildren}
      inputDataAttribute="data-recurrence-child-input"
      inputSelector={childInputSelector}
      isFirstSibling={siblingIndex === 0}
      isLastSibling={siblingIndex === siblingIds.length - 1}
      itemId={item.id}
      labels={{
        ...dictionary.dayEditor,
        cancel: dictionary.actions.cancel,
        delete: dictionary.actions.delete,
      }}
      parentId={item.parentId}
      priority={item.priority}
      siblingIds={siblingIds}
      surface="recurrence"
      text={item.text}
      onAssignCategory={noop}
      onToggleChecked={noop}
    />
  );
}

export function RecurringChildrenEditor({
  items,
  setItems,
}: {
  items: BulkChecklistDraftItem[];
  setItems: DraftSetter;
}) {
  const { dictionary } = useAppContext();
  const labels = dictionary.recurring;
  const rows = useMemo(
    () => buildVisibleBulkChecklistDraftRows(items),
    [items],
  );

  return (
    <section aria-label={labels.childrenTitle} className="grid gap-2">
      <h3 className="px-1 text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.24em] text-[#fff9f2]/90">
        {labels.childrenTitle}
      </h3>
      <TreeListPanel
        addLabel={labels.addSubtask}
        clearSelectionLabel=""
        emptyLabel={labels.childrenEmpty}
        hasRows={rows.length > 0}
        isSelectionMode={false}
        surface="none"
        onAddRoot={() => {
          const id = createId();

          setItems((current) => createBulkChecklistDraftItem(current, { id }));

          return id;
        }}
        onClearSelection={noop}
      >
        {rows.map((row) => (
          <RecurringChildRow
            key={row.item.id}
            row={row}
            rows={rows}
            setItems={setItems}
          />
        ))}
      </TreeListPanel>
    </section>
  );
}
