'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  IconButton,
  filledMediumPillControlClassName,
  taskListSurfaceClassName,
  toast,
} from '@/components/ui';
import { setRecurrenceResponse } from '@/lib/db';
import {
  ALL_CATEGORY_TAB_ID,
  buildCategoryTabs,
  canRespondOnDate,
  filterRowsByCategoryTab,
  getOccurrencesForDate,
  resolveActiveCategoryTab,
  type LocalDateString,
  type Recurrence,
  type RecurrenceOccurrence,
  type RecurrenceResponse,
} from '@/lib/domain';
import {
  addLocalDays,
  formatDateInputValue,
  parseDateInputValue,
} from '@/lib/time';
import { DatePicker, TaskTreeCategoryTabs } from '@/components/app';
import { useCategoryTags } from '@/features/categories';
import { useAppContext } from '@/providers';
import { formatRecurringDate } from './recurrence-format';
import {
  RecurringOccurrence,
  type RecurringAnswerHandler,
} from './recurring-occurrence';

const dayArrowClassName =
  'rounded-full bg-white/8 text-[#cbd5e0] hover:bg-white/12 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]';
const dayMessageClassName = 'py-6 text-center text-sm text-[#aebac8]';

export function RecurringDayToolbar({
  date,
  onDateChange,
}: {
  date: LocalDateString;
  onDateChange: (date: LocalDateString) => void;
}) {
  const { dictionary, locale } = useAppContext();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 lg:contents">
      <div
        aria-hidden="true"
        className="flex-1 basis-36 touch:hidden lg:hidden"
      />
      <div className="flex min-w-0 items-center gap-2 touch:w-full">
        <IconButton
          aria-label={dictionary.recurring.previousDay}
          className={dayArrowClassName}
          onClick={() => onDateChange(addLocalDays(date, -1))}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </IconButton>
        <p
          aria-live="polite"
          className="min-w-88 px-1 text-center text-xl font-semibold first-letter:uppercase text-[#fff9f2] text-balance touch:min-w-0 touch:flex-1 touch:text-lg"
        >
          {formatRecurringDate(date, locale)}
        </p>
        <IconButton
          aria-label={dictionary.recurring.nextDay}
          className={dayArrowClassName}
          onClick={() => onDateChange(addLocalDays(date, 1))}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </IconButton>
      </div>
      <div className="flex flex-1 basis-36 justify-start touch:flex-none touch:basis-auto">
        <DatePicker
          label={dictionary.recurring.chooseDate}
          value={formatDateInputValue(date)}
          variant="trigger"
          renderTrigger={({ isOpen, onClick }) => (
            <button
              type="button"
              aria-expanded={isOpen}
              className={filledMediumPillControlClassName}
              onClick={onClick}
            >
              <CalendarDays aria-hidden="true" className="size-4" />
              {dictionary.recurring.chooseDate}
            </button>
          )}
          onChange={(value) => {
            const nextDate = parseDateInputValue(value);

            if (nextDate) {
              onDateChange(nextDate);
            }
          }}
        />
      </div>
    </div>
  );
}

function useRecurringAnswer(today: LocalDateString): RecurringAnswerHandler {
  const { dictionary, scope } = useAppContext();

  return (occurrence, itemId, status) => {
    if (!scope) {
      return;
    }

    void setRecurrenceResponse({
      date: occurrence.date,
      itemId,
      recurrenceId: occurrence.recurrence.id,
      scope,
      status,
      today,
    })
      .then((saved) => {
        if (!saved) {
          toast.error(dictionary.recurring.saveFailed);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to record a recurrence answer.', error);
        toast.error(dictionary.recurring.saveFailed);
      });
  };
}

function useOccurrenceCategoryTabs(occurrences: RecurrenceOccurrence[]) {
  const { dictionary, scope } = useAppContext();
  const categoryTags = useCategoryTags(scope, 'recurrence');
  const [requestedTabId, setRequestedTabId] = useState(ALL_CATEGORY_TAB_ID);
  const rows = useMemo(
    () => occurrences.map((occurrence) => ({ depth: 0, occurrence })),
    [occurrences],
  );
  const getCategoryTagId = (row: (typeof rows)[number]) =>
    row.occurrence.content.categoryTagId;
  const tabs = buildCategoryTabs({
    allLabel: dictionary.calendar.categoryTabAll,
    categoryTags,
    getCategoryTagId,
    rows,
    uncategorizedLabel: dictionary.calendar.categoryTabUncategorized,
  });
  const showsTabs = tabs.length > 2;
  const activeTab = showsTabs
    ? resolveActiveCategoryTab(tabs, requestedTabId)
    : null;

  return {
    activeTabId: activeTab?.id ?? null,
    categoryTags,
    setRequestedTabId,
    showsTabs,
    tabs,
    visibleOccurrences: activeTab
      ? filterRowsByCategoryTab({
          activeTabId: activeTab.id,
          getCategoryTagId,
          rows,
          tabs,
        }).map((row) => row.occurrence)
      : occurrences,
  };
}

function RecurringOccurrenceList({
  canAnswer,
  occurrences,
  onAnswer,
}: {
  canAnswer: boolean;
  occurrences: RecurrenceOccurrence[];
  onAnswer: RecurringAnswerHandler;
}) {
  const { dictionary } = useAppContext();
  const {
    activeTabId,
    categoryTags,
    setRequestedTabId,
    showsTabs,
    tabs,
    visibleOccurrences,
  } = useOccurrenceCategoryTabs(occurrences);
  const categoryTagMap = useMemo(
    () => new Map(categoryTags.map((tag) => [tag.id, tag])),
    [categoryTags],
  );

  return (
    <div
      data-testid="task-list-surface"
      className={`flex flex-col gap-3 ${taskListSurfaceClassName}`}
    >
      {showsTabs ? (
        <TaskTreeCategoryTabs
          activeTabId={activeTabId}
          label={dictionary.calendar.categoryTabs}
          tabs={tabs}
          onSelect={setRequestedTabId}
        />
      ) : null}
      {occurrences.length === 0 ? (
        <p className={dayMessageClassName}>{dictionary.recurring.dayEmpty}</p>
      ) : (
        <div className="grid gap-1">
          {visibleOccurrences.map((occurrence) => (
            <RecurringOccurrence
              key={occurrence.recurrence.id}
              canAnswer={canAnswer}
              categoryTagMap={categoryTagMap}
              occurrence={occurrence}
              onAnswer={onAnswer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RecurringDayBody({
  date,
  recurrences,
  responses,
  today,
}: {
  date: LocalDateString;
  recurrences: Recurrence[];
  responses: RecurrenceResponse[];
  today: LocalDateString;
}) {
  const { dictionary } = useAppContext();
  const handleAnswer = useRecurringAnswer(today);
  const occurrences = useMemo(
    () => getOccurrencesForDate({ date, recurrences, responses }),
    [date, recurrences, responses],
  );
  const canAnswer = canRespondOnDate(date, today);

  return (
    <>
      {canAnswer ? null : (
        <p className="text-center text-xs text-[#aebac8]">
          {dictionary.recurring.futureHint}
        </p>
      )}
      <RecurringOccurrenceList
        canAnswer={canAnswer}
        occurrences={occurrences}
        onAnswer={handleAnswer}
      />
    </>
  );
}
