'use client';

import {
  ArrowDown,
  ArrowUp,
  IndentDecrease,
  IndentIncrease,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import {
  TaskTreeActionGroup,
  TaskTreeCategoryChip,
  TaskTreeCollapseButton,
  TaskTreeRowLayout,
} from '@/components/app';
import {
  Button,
  Checkbox,
  ConfirmationDialog,
  Dialog,
  IconButton,
  Input,
} from '@/components/ui';
import { CategoryAssignmentMenu, useCategoryTags } from '@/features/categories';
import { useFocusAfterCreate } from '@/hooks/use-focus-after-create';
import {
  applyChecklistTemplateToDateRange,
  clearChecklistItemsFromDateRange,
} from '@/lib/db';
import { createId } from '@/lib/domain';
import { requiresDeleteConfirmation } from '@/lib/confirm-delete';
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
  indentBulkChecklistDraftItem,
  outdentBulkChecklistDraftItem,
  reorderBulkChecklistDraftItem,
  toggleBulkChecklistDraftItemChecked,
  toggleBulkChecklistDraftItemCollapsed,
  toggleBulkChecklistDraftItemPriority,
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

    if (draftItems.length === 0) {
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
        templateItems: draftItems,
        timezone: timezonePreference.timezone,
      });
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    dictionary.calendar.bulkRequireItems,
    draftItems,
    handleClose,
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
  const categoryTags = useCategoryTags(scope, 'calendar');
  const categoryTagMap = new Map(categoryTags.map((tag) => [tag.id, tag]));
  const rows = useMemo(
    () => buildVisibleBulkChecklistDraftRows(draftItems),
    [draftItems],
  );

  const createRootItem = useCallback(() => {
    setDraftItems((currentItems) => createBulkChecklistDraftItem(currentItems));
  }, [setDraftItems]);

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
                row={row}
                setDraftItems={setDraftItems}
              />
            ))}
          </div>
        )}

        {rows.length > 0 ? (
          <div className="flex items-center justify-between px-1 pt-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-[#f0c38e]/[0.22] bg-[#f0c38e]/10 px-3 py-1.5 text-sm font-medium text-[#f7d7ad] shadow-sm transition hover:border-[#f0c38e]/[0.36] hover:bg-[#f0c38e]/[0.16] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
              onClick={createRootItem}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              {dictionary.dayEditor.addItem}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BulkChecklistRow({
  categoryTagMap,
  row,
  setDraftItems,
}: {
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  row: VisibleBulkChecklistDraftRow;
  setDraftItems: React.Dispatch<React.SetStateAction<BulkChecklistDraftItem[]>>;
}) {
  const { dictionary } = useAppContext();
  const { item, depth, hasChildren, isFirstSibling, isLastSibling } = row;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const focusAfterCreate = useFocusAfterCreate();
  const selectedCategory = item.categoryTagId
    ? (categoryTagMap.get(item.categoryTagId) ?? null)
    : null;

  const createSibling = useCallback(() => {
    const newId = createId();
    setDraftItems((currentItems) =>
      createBulkChecklistDraftItem(currentItems, {
        id: newId,
        parentId: item.parentId,
        afterItemId: item.id,
      }),
    );
    return newId;
  }, [item.id, item.parentId, setDraftItems]);

  const createChild = useCallback(() => {
    setDraftItems((currentItems) =>
      createBulkChecklistDraftChild(currentItems, item.id),
    );
  }, [item.id, setDraftItems]);

  const deleteItem = useCallback(() => {
    if (requiresDeleteConfirmation(item.text)) {
      setIsDeleteDialogOpen(true);
      return;
    }

    setDraftItems((currentItems) =>
      deleteBulkChecklistDraftItem(currentItems, item.id),
    );
  }, [item.id, item.text, setDraftItems]);

  const confirmDeleteItem = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setDraftItems((currentItems) =>
      deleteBulkChecklistDraftItem(currentItems, item.id),
    );
  }, [item.id, setDraftItems]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setDraftItems((currentItems) =>
        toggleBulkChecklistDraftItemChecked(currentItems, item.id),
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const newItemId = createSibling();
      focusAfterCreate(newItemId);
      return;
    }

    if (event.key === 'Tab') {
      const checklistInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(bulkChecklistInputSelector),
      );
      const currentIndex = checklistInputs.indexOf(event.currentTarget);
      const targetInput =
        checklistInputs[currentIndex + (event.shiftKey ? -1 : 1)];

      if (!targetInput) {
        return;
      }

      event.preventDefault();

      window.requestAnimationFrame(() => {
        targetInput.focus();
        const caretPosition = targetInput.value.length;
        targetInput.setSelectionRange(caretPosition, caretPosition);
      });
      return;
    }

    if (event.key === 'Backspace' && item.text.length === 0) {
      event.preventDefault();
      setDraftItems((currentItems) =>
        deleteBulkChecklistDraftItem(currentItems, item.id),
      );
    }
  }

  return (
    <>
      <TaskTreeRowLayout
        categoryColorHex={selectedCategory?.colorHex}
        depth={depth}
        isPriority={item.priority}
      >
        <TaskTreeCollapseButton
          collapseLabel={dictionary.dayEditor.collapseItem}
          expandLabel={dictionary.dayEditor.expandItem}
          hasChildren={hasChildren}
          isCollapsed={item.collapsed}
          onClick={() =>
            setDraftItems((currentItems) =>
              toggleBulkChecklistDraftItemCollapsed(currentItems, item.id),
            )
          }
        />

        <Checkbox
          aria-label={dictionary.dayEditor.toggleItem}
          checked={item.checked}
          onChange={() =>
            setDraftItems((currentItems) =>
              toggleBulkChecklistDraftItemChecked(currentItems, item.id),
            )
          }
        />

        <Input
          data-bulk-checklist-input="true"
          data-item-id={item.id}
          value={item.text}
          placeholder={dictionary.dayEditor.itemPlaceholder}
          className={`min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-2 text-sm outline-none transition placeholder:text-[#8f85aa] focus:border-[#f0c38e]/[0.28] focus:bg-white/[0.055] focus:shadow-sm ${
            item.checked ? 'text-[#8f85aa] opacity-75' : 'text-[#fff9f2]'
          }`}
          onChange={(event) =>
            setDraftItems((currentItems) =>
              updateBulkChecklistDraftItemText(
                currentItems,
                item.id,
                event.target.value,
              ),
            )
          }
          onKeyDown={handleKeyDown}
        />

        {selectedCategory ? (
          <TaskTreeCategoryChip
            colorHex={selectedCategory.colorHex}
            name={selectedCategory.name}
          />
        ) : null}

        <TaskTreeActionGroup>
          <IconButton
            aria-label={
              item.priority
                ? dictionary.dayEditor.unmarkPriority
                : dictionary.dayEditor.markPriority
            }
            className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            onClick={() =>
              setDraftItems((currentItems) =>
                toggleBulkChecklistDraftItemPriority(currentItems, item.id),
              )
            }
          >
            <Star
              aria-hidden="true"
              className={`size-4 ${item.priority ? 'fill-current text-[#f0c38e]' : 'opacity-60'}`}
            />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.moveItemUp}
            className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            disabled={isFirstSibling}
            onClick={() =>
              setDraftItems((currentItems) =>
                reorderBulkChecklistDraftItem(currentItems, item.id, 'up'),
              )
            }
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.moveItemDown}
            className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            disabled={isLastSibling}
            onClick={() =>
              setDraftItems((currentItems) =>
                reorderBulkChecklistDraftItem(currentItems, item.id, 'down'),
              )
            }
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.addChild}
            className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            onClick={createChild}
          >
            <Plus aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.indentItem}
            className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            onClick={() =>
              setDraftItems((currentItems) =>
                indentBulkChecklistDraftItem(currentItems, item.id),
              )
            }
          >
            <IndentIncrease aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.outdentItem}
            className="rounded-full hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            onClick={() =>
              setDraftItems((currentItems) =>
                outdentBulkChecklistDraftItem(currentItems, item.id),
              )
            }
          >
            <IndentDecrease aria-hidden="true" className="size-4" />
          </IconButton>
          <CategoryAssignmentMenu
            assignLabel={dictionary.dayEditor.assignCategory}
            clearLabel={dictionary.dayEditor.clearCategory}
            selectedCategoryTagId={item.categoryTagId}
            surface="calendar"
            onAssign={(categoryTagId) =>
              setDraftItems((currentItems) =>
                assignBulkChecklistDraftItemCategory(
                  currentItems,
                  item.id,
                  categoryTagId,
                ),
              )
            }
          />
          <IconButton
            aria-label={dictionary.dayEditor.deleteItem}
            className="rounded-full hover:bg-rose-400/[0.12] hover:text-rose-100 focus-visible:outline-[#f0c38e]"
            onClick={() => deleteItem()}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        </TaskTreeActionGroup>
      </TaskTreeRowLayout>

      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmLabel={dictionary.actions.delete}
        description={dictionary.dayEditor.confirmDeleteItem}
        open={isDeleteDialogOpen}
        title={dictionary.dayEditor.deleteItem}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDeleteItem}
      />
    </>
  );
}
