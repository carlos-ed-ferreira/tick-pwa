'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { TaskTreeEditableRow } from '@/components/app';
import { Button, Dialog, Input } from '@/components/ui';
import { useCategoryTags } from '@/features/categories';
import { useFocusAfterCreate } from '@/hooks/use-focus-after-create';
import { useTreeSelection } from '@/hooks/use-tree-selection';
import {
  applyChecklistTemplateToDateRange,
  clearChecklistItemsFromDateRange,
} from '@/lib/db';
import { createId } from '@/lib/domain';
import type { WeekdayIndex } from '@/lib/time';
import {
  getDatesInRangeForWeekdays,
  maskDateInput,
  parseDateInputValue,
} from '@/lib/time';
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
  outdentBulkChecklistDraftItem,
  reorderBulkChecklistDraftItem,
  toggleBulkChecklistDraftItemChecked,
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

    if (selectedWeekdays.length === 0) {
      setValidationMessage(dictionary.calendar.bulkSelectWeekdays);
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
    dictionary.calendar.bulkSelectWeekdays,
    endDateInput,
    selectedWeekdays,
    startDateInput,
  ]);

  const applyBulkRange = useCallback(async () => {
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
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    dictionary.calendar.bulkRequireItems,
    handleClose,
    sanitizedDraftItems,
    scope,
    timezonePreference.timezone,
    validateBulkDateRange,
  ]);

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
        <div className="modal-panel grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="grid gap-2 text-sm font-medium text-[#fff9f2]">
            <span>{dictionary.calendar.bulkStartDate}</span>
            <Input
              aria-label={dictionary.calendar.bulkStartDate}
              inputMode="numeric"
              maxLength={10}
              placeholder={dictionary.calendar.bulkDatePlaceholder}
              value={startDateInput}
              className="h-12 rounded-[1rem] border border-white/10 bg-white/[0.055] px-3 text-sm text-[#fff9f2] outline-none transition placeholder:text-[#8f85aa] hover:border-white/[0.16] focus:border-[#f0c38e]/[0.42] focus:bg-white/[0.075] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
              onChange={(event) =>
                setStartDateInput(maskDateInput(event.target.value))
              }
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[#fff9f2]">
            <span>{dictionary.calendar.bulkEndDate}</span>
            <Input
              aria-label={dictionary.calendar.bulkEndDate}
              inputMode="numeric"
              maxLength={10}
              placeholder={dictionary.calendar.bulkDatePlaceholder}
              value={endDateInput}
              className="h-12 rounded-[1rem] border border-white/10 bg-white/[0.055] px-3 text-sm text-[#fff9f2] outline-none transition placeholder:text-[#8f85aa] hover:border-white/[0.16] focus:border-[#f0c38e]/[0.42] focus:bg-white/[0.075] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
              onChange={(event) =>
                setEndDateInput(maskDateInput(event.target.value))
              }
            />
          </label>

          <div className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium text-[#fff9f2]">
              {dictionary.calendar.bulkWeekdays}
            </span>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {weekdayOptions.map((weekday) => {
                const isSelected = selectedWeekdays.includes(weekday);

                return (
                  <button
                    key={weekday}
                    type="button"
                    aria-pressed={isSelected}
                    className={`h-11 rounded-full border px-3 text-sm font-medium shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] ${
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
          <div className="rounded-[1rem] border border-rose-300/[0.18] bg-rose-400/[0.12] px-3 py-2 text-sm font-medium text-rose-100 shadow-sm">
            {validationMessage}
          </div>
        ) : null}

        {isCreateMode ? (
          <BulkChecklistSurface
            draftItems={draftItems}
            setDraftItems={setDraftItems}
          />
        ) : (
          <div className="modal-panel flex min-h-0 flex-1 items-center justify-center gap-3 bg-rose-400/[0.08] p-6 text-center text-sm font-medium leading-6 text-rose-100">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-rose-200/18 bg-rose-300/12 text-rose-100">
              <Trash2 aria-hidden="true" className="size-5" />
            </span>
            <span>{dictionary.calendar.bulkClearDescription}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            className="h-12 rounded-[1.15rem] border border-white/10 bg-white/5 px-5 text-[#fff9f2] hover:bg-white/[0.09] focus-visible:outline-[#f0c38e]"
            tone="subtle"
            onClick={handleClose}
          >
            {dictionary.actions.cancel}
          </Button>
          <Button
            className={`h-12 rounded-[1.15rem] px-5 ${
              isCreateMode
                ? 'border border-[#f8d7aa]/70 bg-[#f0c38e] text-[#312c51] shadow-[0_16px_32px_rgba(240,195,142,0.18)] hover:border-[#ffe0b8] hover:bg-[#f5d09f] focus-visible:outline-[#f0c38e]'
                : 'border border-rose-300/[0.24] bg-rose-400/[0.15] text-rose-50 shadow-[0_14px_28px_rgba(244,63,94,0.14)] hover:bg-rose-400/[0.22] focus-visible:outline-rose-200'
            }`}
            tone={isCreateMode ? 'accent' : 'danger'}
            disabled={isSubmitting}
            onClick={() =>
              void (isCreateMode ? applyBulkRange() : clearBulkRange())
            }
          >
            {isCreateMode
              ? dictionary.calendar.bulkApply
              : dictionary.calendar.bulkClearApply}
          </Button>
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
  const focusAfterCreate = useFocusAfterCreate();
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
    focusAfterCreate(newId);
  }, [focusAfterCreate, setDraftItems]);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="modal-panel min-h-0 flex-1 overflow-y-auto p-2">
        {rows.length === 0 ? (
          <button
            type="button"
            className="flex min-h-36 w-full items-center justify-center rounded-[1.15rem] border border-dashed border-[#f0c38e]/[0.24] bg-[#f0c38e]/[0.045] px-4 text-sm font-medium text-[#bdb4d4] shadow-inner transition hover:border-[#f0c38e]/[0.38] hover:bg-[#f0c38e]/[0.075] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
            onClick={createRootItem}
          >
            {dictionary.calendar.bulkEmptyChecklist}
          </button>
        ) : (
          <div className="grid gap-1">
            {rows.map((row) => (
              <BulkChecklistRow
                key={row.item.id}
                categoryTagMap={categoryTagMap}
                isSelected={isSelected(row.item.id)}
                isSelectionMode={isSelectionMode}
                row={row}
                selectedIds={selectedIds}
                onClearSelection={clearSelection}
                onToggleSelect={toggleSelect}
                setDraftItems={setDraftItems}
              />
            ))}
          </div>
        )}

        {rows.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-[#f0c38e]/[0.22] bg-[#f0c38e]/10 px-3 py-1.5 text-sm font-medium text-[#f7d7ad] shadow-sm transition hover:border-[#f0c38e]/[0.36] hover:bg-[#f0c38e]/[0.16] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
              onClick={createRootItem}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              {dictionary.dayEditor.addItem}
            </button>
            {isSelectionMode ? (
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-sm font-medium text-[#bdb4d4] transition hover:border-white/[0.16] hover:bg-white/[0.09] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
                onClick={clearSelection}
              >
                {dictionary.dayEditor.itemsSelected.replace(
                  '{count}',
                  String(selectedCount),
                )}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BulkChecklistRow({
  categoryTagMap,
  isSelected,
  isSelectionMode,
  row,
  selectedIds,
  onClearSelection,
  onToggleSelect,
  setDraftItems,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  isSelected: boolean;
  isSelectionMode: boolean;
  row: VisibleBulkChecklistDraftRow;
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  setDraftItems: React.Dispatch<React.SetStateAction<BulkChecklistDraftItem[]>>;
}) {
  const { dictionary } = useAppContext();
  const { item, depth, hasChildren, isFirstSibling, isLastSibling } = row;

  return (
    <TaskTreeEditableRow
      categoryTagId={item.categoryTagId}
      categoryTagMap={categoryTagMap}
      checked={item.checked}
      collapsed={item.collapsed}
      depth={depth}
      hasChildren={hasChildren}
      inputDataAttribute="data-bulk-checklist-input"
      inputSelector={bulkChecklistInputSelector}
      isFirstSibling={isFirstSibling}
      isLastSibling={isLastSibling}
      itemId={item.id}
      labels={{
        ...dictionary.dayEditor,
        cancel: dictionary.actions.cancel,
        delete: dictionary.actions.delete,
      }}
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
        onBulkToggleChecked: async (nextChecked) => {
          setDraftItems((currentItems) =>
            currentItems.map((currentItem) =>
              selectedIds.has(currentItem.id)
                ? { ...currentItem, checked: nextChecked }
                : currentItem,
            ),
          );
        },
        onToggle: (shiftKey) => onToggleSelect(item.id, shiftKey),
      }}
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
      onMoveTo={({ itemId, targetItemId, placement }) =>
        setDraftItems((currentItems) =>
          moveBulkChecklistDraftItemToTarget(
            currentItems,
            itemId,
            targetItemId,
            placement,
          ),
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
