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
  Text,
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
        <div className="grid gap-4 rounded-lg border border-border bg-background/50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            <span>{dictionary.calendar.bulkStartDate}</span>
            <Input
              aria-label={dictionary.calendar.bulkStartDate}
              inputMode="numeric"
              maxLength={10}
              placeholder={dictionary.calendar.bulkDatePlaceholder}
              value={startDateInput}
              className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none transition focus:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              onChange={(event) =>
                setStartDateInput(maskDateInput(event.target.value))
              }
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            <span>{dictionary.calendar.bulkEndDate}</span>
            <Input
              aria-label={dictionary.calendar.bulkEndDate}
              inputMode="numeric"
              maxLength={10}
              placeholder={dictionary.calendar.bulkDatePlaceholder}
              value={endDateInput}
              className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none transition focus:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              onChange={(event) =>
                setEndDateInput(maskDateInput(event.target.value))
              }
            />
          </label>

          <div className="grid gap-2 sm:col-span-2">
            <Text as="span" weight="medium">
              {dictionary.calendar.bulkWeekdays}
            </Text>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {weekdayOptions.map((weekday) => {
                const isSelected = selectedWeekdays.includes(weekday);

                return (
                  <button
                    key={weekday}
                    type="button"
                    aria-pressed={isSelected}
                    className={`min-h-10 rounded-md border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                      isSelected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-surface text-muted hover:border-foreground/30 hover:text-foreground'
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
          <div className="rounded-md border border-rose-600/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {validationMessage}
          </div>
        ) : null}

        {isCreateMode ? (
          <BulkChecklistSurface
            draftItems={draftItems}
            setDraftItems={setDraftItems}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center gap-3 rounded-lg border border-rose-600 bg-rose-600/10 p-6 text-center text-sm font-medium leading-6 text-rose-100 shadow-sm">
            <Trash2 aria-hidden="true" className="size-5 shrink-0" />
            <span>{dictionary.calendar.bulkClearDescription}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button className="min-h-11 px-4" onClick={handleClose}>
            {dictionary.actions.cancel}
          </Button>
          <Button
            className={`min-h-11 px-4 ${isCreateMode ? '' : 'border-rose-500/40 text-rose-100 hover:border-rose-400/60'}`}
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
  const categoryTags = useCategoryTags(scope);
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
              <BulkChecklistRow
                key={row.item.id}
                categoryTagMap={categoryTagMap}
                row={row}
                setDraftItems={setDraftItems}
              />
            ))}
          </div>
        )}
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
          className={`min-w-0 flex-1 rounded-md bg-transparent px-2 py-2 text-sm outline-none transition focus:bg-surface focus:shadow-sm ${
            item.checked ? 'opacity-50' : 'text-foreground'
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
            onClick={() =>
              setDraftItems((currentItems) =>
                toggleBulkChecklistDraftItemPriority(currentItems, item.id),
              )
            }
          >
            <Star
              aria-hidden="true"
              className={`size-4 ${item.priority ? 'fill-current text-amber-500' : 'opacity-60'}`}
            />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.moveItemUp}
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
            onClick={createChild}
          >
            <Plus aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton
            aria-label={dictionary.dayEditor.indentItem}
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
