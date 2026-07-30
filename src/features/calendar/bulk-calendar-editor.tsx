'use client';

import { CheckCheck, Clock3, Eraser, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
  DatePicker,
  TaskTreeBulkActions,
  TaskTreeEditableRow,
  TaskTreeRowActionsMenu,
  TreeListPanel,
  type TaskTreeRowActionPreferences,
} from '@/components/app';
import { Dialog, IconButton, ModalActionButton } from '@/components/ui';
import { useCategoryTags } from '@/features/categories';
import { useTreeSelection } from '@/hooks/use-tree-selection';
import { useTaskTreeRowActionPreferences } from '@/hooks/use-task-tree-row-action-visibility';
import {
  applyChecklistTemplateToDateRange,
  clearChecklistItemsFromDateRange,
} from '@/lib/db';
import { createId, type TaskCompletionValues } from '@/lib/domain';
import { formatSelectionLabel } from '@/lib/i18n';
import type { WeekdayIndex } from '@/lib/time';
import { getDatesInRangeForWeekdays, parseDateInputValue } from '@/lib/time';
import { useAppContext } from '@/providers';
import {
  assignBulkChecklistDraftItemCategory,
  buildVisibleBulkChecklistDraftRows,
  createBulkChecklistDraftChild,
  createBulkChecklistDraftItem,
  deleteBulkChecklistDraftItem,
  filterBulkChecklistDraftItems,
  indentBulkChecklistDraftItem,
  moveBulkChecklistDraftItemToTarget,
  moveBulkChecklistDraftItemToParent,
  outdentBulkChecklistDraftItem,
  reorderBulkChecklistDraftItem,
  reorderBulkChecklistDraftItemsByScheduledTime,
  toggleBulkChecklistDraftItemChecked,
  toggleBulkChecklistDraftItemBold,
  toggleBulkChecklistDraftItemCollapsed,
  toggleBulkChecklistDraftItemPriority,
  updateBulkChecklistDraftItemScheduledTime,
  updateBulkChecklistDraftItemText,
  type BulkChecklistDraftItem,
  type VisibleBulkChecklistDraftRow,
} from './bulk-checklist-draft';

const bulkChecklistInputSelector = '[data-bulk-checklist-input="true"]';
const weekdayOptions: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6];
type BulkCalendarEditorMode = 'create' | 'clear';

export function BulkCalendarEditor({
  mode = 'create',
  open,
  onClose,
}: {
  mode?: BulkCalendarEditorMode;
  open: boolean;
  onClose: () => void;
}) {
  const { dictionary, scope, timezonePreference } = useAppContext();
  const isCreateMode = mode === 'create';
  const [draftItems, setDraftItems] = useState<BulkChecklistDraftItem[]>([]);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [selectedWeekdays, setSelectedWeekdays] = useState<WeekdayIndex[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sanitizedDraftItems = useMemo(
    () => filterBulkChecklistDraftItems(draftItems),
    [draftItems],
  );

  const resetEditor = useCallback(() => {
    setDraftItems([]);
    setStartDateInput('');
    setEndDateInput('');
    setSelectedWeekdays([]);
    setValidationMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetEditor();
    onClose();
  }, [onClose, resetEditor]);

  const toggleWeekday = useCallback((weekday: WeekdayIndex) => {
    setSelectedWeekdays((currentWeekdays) =>
      currentWeekdays.includes(weekday)
        ? currentWeekdays.filter((currentWeekday) => currentWeekday !== weekday)
        : [...currentWeekdays, weekday].sort(
            (firstDay, secondDay) => firstDay - secondDay,
          ),
    );
  }, []);

  const validateBulkDateRange = useCallback(() => {
    if (!startDateInput.trim() || !endDateInput.trim()) {
      setValidationMessage(dictionary.calendar.bulkRequiredDates);
      return null;
    }

    const startDate = parseDateInputValue(startDateInput);
    const endDate = parseDateInputValue(endDateInput);

    if (!startDate || !endDate) {
      setValidationMessage(dictionary.calendar.bulkInvalidDates);
      return null;
    }

    if (startDate > endDate) {
      setValidationMessage(dictionary.calendar.bulkInvalidRange);
      return null;
    }

    if (
      getDatesInRangeForWeekdays({
        startDate,
        endDate,
        selectedWeekdays,
      }).length === 0
    ) {
      setValidationMessage(dictionary.calendar.bulkNoMatchingDates);
      return null;
    }

    return {
      endDate,
      selectedWeekdays,
      startDate,
    };
  }, [
    dictionary.calendar.bulkInvalidDates,
    dictionary.calendar.bulkInvalidRange,
    dictionary.calendar.bulkNoMatchingDates,
    dictionary.calendar.bulkRequiredDates,
    endDateInput,
    selectedWeekdays,
    startDateInput,
  ]);

  const applyBulkRange = useCallback(
    async (closeAfterApply = false) => {
      if (!scope) {
        return;
      }

      const rangeSelection = validateBulkDateRange();

      if (!rangeSelection) {
        return;
      }

      if (sanitizedDraftItems.length === 0) {
        setValidationMessage(dictionary.calendar.bulkRequireItems);
        return;
      }

      setValidationMessage(null);
      setSuccessMessage(null);
      setIsSubmitting(true);

      try {
        await applyChecklistTemplateToDateRange({
          scope,
          startDate: rangeSelection.startDate,
          endDate: rangeSelection.endDate,
          selectedWeekdays: rangeSelection.selectedWeekdays,
          templateItems: sanitizedDraftItems,
          timezone: timezonePreference.timezone,
        });
        if (closeAfterApply) {
          handleClose();
        } else {
          setSuccessMessage(dictionary.calendar.bulkCreated);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      dictionary.calendar.bulkCreated,
      dictionary.calendar.bulkRequireItems,
      handleClose,
      sanitizedDraftItems,
      scope,
      timezonePreference.timezone,
      validateBulkDateRange,
    ],
  );

  const clearDraftTasks = useCallback(() => {
    setDraftItems([]);
    setValidationMessage(null);
    setSuccessMessage(null);
  }, []);

  const clearBulkRange = useCallback(async () => {
    if (!scope) {
      return;
    }

    const rangeSelection = validateBulkDateRange();

    if (!rangeSelection) {
      return;
    }

    setValidationMessage(null);
    setIsSubmitting(true);

    try {
      await clearChecklistItemsFromDateRange({
        scope,
        startDate: rangeSelection.startDate,
        endDate: rangeSelection.endDate,
        selectedWeekdays: rangeSelection.selectedWeekdays,
      });
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [handleClose, scope, validateBulkDateRange]);

  return (
    <Dialog
      closeLabel={dictionary.actions.cancel}
      open={open}
      title={
        isCreateMode
          ? dictionary.calendar.bulkEditorTitle
          : dictionary.calendar.bulkClearEditorTitle
      }
      onClose={handleClose}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <DatePicker
            label={dictionary.calendar.bulkStartDate}
            placeholder={dictionary.calendar.bulkDatePlaceholder}
            value={startDateInput}
            onChange={setStartDateInput}
          />

          <DatePicker
            label={dictionary.calendar.bulkEndDate}
            placeholder={dictionary.calendar.bulkDatePlaceholder}
            value={endDateInput}
            onChange={setEndDateInput}
          />

          <div className="grid gap-2 sm:col-span-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-[#fff9f2]">
                {dictionary.calendar.bulkWeekdays}
              </span>
              <span className="text-xs text-[#9f95b8]">
                {dictionary.calendar.bulkAllWeekdaysHint}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {weekdayOptions.map((weekday) => {
                const isSelected = selectedWeekdays.includes(weekday);

                return (
                  <button
                    key={weekday}
                    type="button"
                    aria-pressed={isSelected}
                    className={`h-8 rounded-full border px-3 text-sm font-medium shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] ${
                      isSelected
                        ? 'border-[#f8d7aa]/70 bg-[#f0c38e] text-[#312c51] shadow-[0_12px_24px_rgba(240,195,142,0.16)]'
                        : 'border-white/10 bg-white/[0.045] text-[#bdb4d4] hover:border-[#f0c38e]/[0.28] hover:bg-[#f0c38e]/10 hover:text-[#fff9f2]'
                    }`}
                    onClick={() => toggleWeekday(weekday)}
                  >
                    {dictionary.calendar.weekdays[weekday]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {validationMessage ? (
          <div className="rounded-xl bg-rose-400/[0.12] px-3 py-2 text-sm font-medium text-rose-100">
            {validationMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div
            role="status"
            className="rounded-xl bg-emerald-400/[0.1] px-3 py-2 text-sm font-medium text-emerald-100"
          >
            {successMessage}
          </div>
        ) : null}

        {isCreateMode ? (
          <BulkChecklistSurface
            draftItems={draftItems}
            setDraftItems={setDraftItems}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center gap-3 rounded-xl bg-rose-400/[0.08] p-6 text-center text-sm font-medium leading-6 text-rose-100">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-300/12 text-rose-100">
              <Trash2 aria-hidden="true" className="size-5" />
            </span>
            <span>{dictionary.calendar.bulkClearDescription}</span>
          </div>
        )}

        <div
          className={`flex flex-wrap items-center gap-2 ${
            isCreateMode ? 'justify-between' : 'justify-end'
          }`}
        >
          {isCreateMode ? (
            <ModalActionButton
              disabled={draftItems.length === 0 || isSubmitting}
              onClick={clearDraftTasks}
            >
              <Eraser aria-hidden="true" className="size-3.5" />
              {dictionary.calendar.bulkClearTasks}
            </ModalActionButton>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <ModalActionButton onClick={handleClose}>
              <X aria-hidden="true" className="size-3.5" />
              {dictionary.actions.cancel}
            </ModalActionButton>
            {isCreateMode ? (
              <ModalActionButton
                tone="secondary"
                disabled={isSubmitting}
                onClick={() => void applyBulkRange(true)}
              >
                <CheckCheck aria-hidden="true" className="size-3.5" />
                {dictionary.calendar.bulkApplyAndClose}
              </ModalActionButton>
            ) : null}
            <ModalActionButton
              tone={isCreateMode ? 'accent' : 'danger'}
              disabled={isSubmitting}
              onClick={() =>
                void (isCreateMode ? applyBulkRange() : clearBulkRange())
              }
            >
              {isCreateMode ? (
                <Plus aria-hidden="true" className="size-3.5" />
              ) : (
                <Trash2 aria-hidden="true" className="size-3.5" />
              )}
              {isCreateMode
                ? dictionary.calendar.bulkApply
                : dictionary.calendar.bulkClearApply}
            </ModalActionButton>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function BulkChecklistSurface({
  draftItems,
  setDraftItems,
}: {
  draftItems: BulkChecklistDraftItem[];
  setDraftItems: React.Dispatch<React.SetStateAction<BulkChecklistDraftItem[]>>;
}) {
  const { dictionary, scope } = useAppContext();
  const {
    actionPreferences,
    applyActionPreferencesToOtherSurface,
    setActionPreferences,
  } = useTaskTreeRowActionPreferences('checklist_item');
  const categoryTags = useCategoryTags(scope, 'checklist_item');
  const categoryTagMap = new Map(categoryTags.map((tag) => [tag.id, tag]));
  const rows = useMemo(
    () => buildVisibleBulkChecklistDraftRows(draftItems),
    [draftItems],
  );
  const visibleItemIds = useMemo(() => rows.map((row) => row.item.id), [rows]);
  const {
    clearSelection,
    isSelected,
    isSelectionMode,
    selectedCount,
    selectedIds,
    toggleSelect,
  } = useTreeSelection(visibleItemIds);

  const createRootItem = useCallback(() => {
    const newId = createId();
    setDraftItems((currentItems) =>
      createBulkChecklistDraftItem(currentItems, { id: newId }),
    );
    return newId;
  }, [setDraftItems]);
  const selectedItems = draftItems.filter((item) => selectedIds.has(item.id));
  const allSelectedPriority =
    selectedItems.length > 0 && selectedItems.every((item) => item.priority);
  const allSelectedBold =
    selectedItems.length > 0 && selectedItems.every((item) => item.bold);
  const selectedLabel = formatSelectionLabel({
    count: selectedCount,
    plural: dictionary.dayEditor.itemsSelected,
    singular: dictionary.dayEditor.itemSelected,
  });

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <TreeListPanel
        addLabel={dictionary.dayEditor.addItem}
        clearSelectionLabel={selectedLabel}
        emptyLabel={dictionary.calendar.bulkEmptyChecklist}
        hasRows={rows.length > 0}
        isSelectionMode={isSelectionMode}
        surface="none"
        onAddRoot={createRootItem}
        onClearSelection={clearSelection}
        selectionActions={
          <TaskTreeBulkActions
            actionPreferences={actionPreferences}
            allBold={allSelectedBold}
            allPriority={allSelectedPriority}
            labels={{
              bold: dictionary.dayEditor.bulkBold,
              category: dictionary.dayEditor.bulkCategory,
              clearCategory: dictionary.dayEditor.clearCategory,
              delete: dictionary.dayEditor.bulkDelete,
              priority: dictionary.dayEditor.bulkPriority,
              selected: selectedLabel,
            }}
            surface="checklist_item"
            onAssignCategory={async (categoryTagId) => {
              setDraftItems((currentItems) =>
                currentItems.map((item) =>
                  selectedIds.has(item.id) ? { ...item, categoryTagId } : item,
                ),
              );
            }}
            onDelete={() => {
              setDraftItems((currentItems) =>
                [...selectedIds].reduce(
                  (nextItems, selectedId) =>
                    deleteBulkChecklistDraftItem(nextItems, selectedId),
                  currentItems,
                ),
              );
              clearSelection();
            }}
            onToggleBold={async () => {
              const nextBold = !allSelectedBold;
              setDraftItems((currentItems) =>
                currentItems.map((item) =>
                  selectedIds.has(item.id) ? { ...item, bold: nextBold } : item,
                ),
              );
            }}
            onTogglePriority={async () => {
              const nextPriority = !allSelectedPriority;
              setDraftItems((currentItems) =>
                currentItems.map((item) =>
                  selectedIds.has(item.id)
                    ? { ...item, priority: nextPriority }
                    : item,
                ),
              );
            }}
          />
        }
        toolbarActions={
          <>
            <IconButton
              aria-label={dictionary.calendar.sortByTime}
              size="compact"
              title={dictionary.calendar.sortByTime}
              className="rounded-full border border-white/10 bg-white/5 text-[#bdb4d4] hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
              onClick={() =>
                setDraftItems((currentItems) =>
                  reorderBulkChecklistDraftItemsByScheduledTime(currentItems),
                )
              }
            >
              <Clock3 aria-hidden="true" className="size-4" />
            </IconButton>
            <TaskTreeRowActionsMenu
              labels={{
                actions: {
                  add: dictionary.dayEditor.addChild,
                  bold: dictionary.dayEditor.bulkBold,
                  category: dictionary.dayEditor.bulkCategory,
                  clearCategory: dictionary.dayEditor.clearCategory,
                  delete: dictionary.dayEditor.bulkDelete,
                  drag: dictionary.dayEditor.dragAndDrop,
                  indent: dictionary.dayEditor.indentItem,
                  moveDown: dictionary.dayEditor.moveItemDown,
                  moveUp: dictionary.dayEditor.moveItemUp,
                  outdent: dictionary.dayEditor.outdentItem,
                  priority: dictionary.dayEditor.bulkPriority,
                  scheduledTime: dictionary.dayEditor.itemTime,
                },
                applyToOtherSurface: dictionary.dayEditor.applyToOtherSurface,
                close: dictionary.actions.cancel,
                configure: dictionary.dayEditor.configureRowActions,
                hidden: dictionary.dayEditor.actionHidden,
                inline: dictionary.dayEditor.actionOnRow,
                menu: dictionary.dayEditor.actionInMenu,
                reset: dictionary.dayEditor.resetRowActions,
                title: dictionary.dayEditor.rowActionsTitle,
                visible: dictionary.dayEditor.actionVisible,
              }}
              value={actionPreferences}
              onApplyToOtherSurface={(nextPreferences) =>
                void applyActionPreferencesToOtherSurface(nextPreferences)
              }
              onChange={setActionPreferences}
            />
          </>
        }
      >
        {rows.map((row) => (
          <BulkChecklistRow
            key={row.item.id}
            actionPreferences={actionPreferences}
            categoryTagMap={categoryTagMap}
            isSelected={isSelected(row.item.id)}
            isSelectionMode={isSelectionMode}
            row={row}
            rows={rows}
            selectedIds={selectedIds}
            onClearSelection={clearSelection}
            onToggleSelect={toggleSelect}
            setDraftItems={setDraftItems}
          />
        ))}
      </TreeListPanel>
    </section>
  );
}

function BulkChecklistRow({
  actionPreferences,
  categoryTagMap,
  isSelected,
  isSelectionMode,
  row,
  rows,
  selectedIds,
  onClearSelection,
  onToggleSelect,
  setDraftItems,
}: {
  actionPreferences: TaskTreeRowActionPreferences;
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  isSelected: boolean;
  isSelectionMode: boolean;
  row: VisibleBulkChecklistDraftRow;
  rows: VisibleBulkChecklistDraftRow[];
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  setDraftItems: React.Dispatch<React.SetStateAction<BulkChecklistDraftItem[]>>;
}) {
  const { dictionary } = useAppContext();
  const { item, depth, hasChildren } = row;
  const siblingIds = rows
    .filter((currentRow) => currentRow.item.parentId === item.parentId)
    .map((currentRow) => currentRow.item.id);
  const siblingIndex = siblingIds.indexOf(item.id);

  function moveItemToTarget({
    itemId,
    targetItemId,
    placement,
  }: {
    itemId: string;
    targetItemId: string;
    placement: 'before' | 'child' | 'after';
  }) {
    setDraftItems((currentItems) =>
      placement === 'child'
        ? moveBulkChecklistDraftItemToParent(currentItems, itemId, targetItemId)
        : moveBulkChecklistDraftItemToTarget(
            currentItems,
            itemId,
            targetItemId,
            placement,
          ),
    );
  }

  return (
    <TaskTreeEditableRow
      actionPreferences={actionPreferences}
      bold={item.bold}
      categoryTagId={item.categoryTagId}
      categoryTagMap={categoryTagMap}
      checked={item.checked}
      ignored={item.ignored}
      collapsed={item.collapsed}
      depth={depth}
      hasChildren={hasChildren}
      inputDataAttribute="data-bulk-checklist-input"
      inputSelector={bulkChecklistInputSelector}
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
      scheduledTime={item.scheduledTime}
      selection={{
        isSelected,
        isSelectionMode,
        onBulkAssignCategory: async (categoryTagId) => {
          setDraftItems((currentItems) =>
            currentItems.map((currentItem) =>
              selectedIds.has(currentItem.id)
                ? { ...currentItem, categoryTagId }
                : currentItem,
            ),
          );
        },
        onBulkDelete: () => {
          setDraftItems((currentItems) =>
            [...selectedIds].reduce(
              (nextItems, selectedId) =>
                deleteBulkChecklistDraftItem(nextItems, selectedId),
              currentItems,
            ),
          );
          onClearSelection();
        },
        onBulkToggleChecked: async (nextValues: TaskCompletionValues) => {
          setDraftItems((currentItems) =>
            currentItems.map((currentItem) =>
              selectedIds.has(currentItem.id)
                ? {
                    ...currentItem,
                    checked: nextValues.completed,
                    ignored: nextValues.ignored,
                  }
                : currentItem,
            ),
          );
        },
        onToggle: (shiftKey) => onToggleSelect(item.id, shiftKey),
      }}
      siblingIds={siblingIds}
      surface="checklist_item"
      text={item.text}
      showScheduledTime={true}
      isDraft
      onAssignCategory={(categoryTagId) =>
        setDraftItems((currentItems) =>
          assignBulkChecklistDraftItemCategory(
            currentItems,
            item.id,
            categoryTagId,
          ),
        )
      }
      onCreateChild={() => {
        const newId = createId();
        setDraftItems((currentItems) =>
          createBulkChecklistDraftChild(currentItems, item.id, newId),
        );

        return newId;
      }}
      onCreateSibling={() => {
        const newId = createId();
        setDraftItems((currentItems) =>
          createBulkChecklistDraftItem(currentItems, {
            id: newId,
            parentId: item.parentId,
            afterItemId: item.id,
          }),
        );
        return newId;
      }}
      onDelete={() =>
        setDraftItems((currentItems) =>
          deleteBulkChecklistDraftItem(currentItems, item.id),
        )
      }
      onIndent={() =>
        setDraftItems((currentItems) =>
          indentBulkChecklistDraftItem(currentItems, item.id),
        )
      }
      onMoveTo={moveItemToTarget}
      onMoveDown={() =>
        setDraftItems((currentItems) =>
          reorderBulkChecklistDraftItem(currentItems, item.id, 'down'),
        )
      }
      onMoveUp={() =>
        setDraftItems((currentItems) =>
          reorderBulkChecklistDraftItem(currentItems, item.id, 'up'),
        )
      }
      onOutdent={() =>
        setDraftItems((currentItems) =>
          outdentBulkChecklistDraftItem(currentItems, item.id),
        )
      }
      onSaveText={(text) =>
        setDraftItems((currentItems) =>
          updateBulkChecklistDraftItemText(currentItems, item.id, text),
        )
      }
      onTextChange={(text) =>
        setDraftItems((currentItems) =>
          updateBulkChecklistDraftItemText(currentItems, item.id, text),
        )
      }
      onSaveTime={(scheduledTime) =>
        setDraftItems((currentItems) =>
          updateBulkChecklistDraftItemScheduledTime(
            currentItems,
            item.id,
            scheduledTime,
          ),
        )
      }
      onToggleChecked={() =>
        setDraftItems((currentItems) =>
          toggleBulkChecklistDraftItemChecked(currentItems, item.id),
        )
      }
      onToggleBold={() =>
        setDraftItems((currentItems) =>
          toggleBulkChecklistDraftItemBold(currentItems, item.id),
        )
      }
      onToggleCollapsed={() =>
        setDraftItems((currentItems) =>
          toggleBulkChecklistDraftItemCollapsed(currentItems, item.id),
        )
      }
      onTogglePriority={() =>
        setDraftItems((currentItems) =>
          toggleBulkChecklistDraftItemPriority(currentItems, item.id),
        )
      }
    />
  );
}
