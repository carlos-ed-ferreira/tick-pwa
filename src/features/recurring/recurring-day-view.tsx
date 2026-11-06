'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  IconButton,
  filledCompactPillControlClassName,
  filledControlNeutralClassName,
  toast,
} from '@/components/ui';
import { setRecurrenceResponse } from '@/lib/db';
import {
  canRespondOnDate,
  getOccurrencesForDate,
  type LocalDateString,
  type Recurrence,
  type RecurrenceOccurrence,
  type RecurrenceResponse,
} from '@/lib/domain';
import { addLocalDays } from '@/lib/time';
import { useCategoryTags } from '@/features/categories';
import { useAppContext } from '@/providers';
import { formatRecurringDate } from './recurrence-format';
import { RecurringDateDialog } from './recurring-date-dialog';
import {
  RecurringOccurrence,
  type RecurringAnswerHandler,
} from './recurring-occurrence';

const dayActionClassName = `${filledCompactPillControlClassName} ${filledControlNeutralClassName}`;
const dayArrowClassName =
  'rounded-full bg-white/8 text-[#cbd5e0] hover:bg-white/12 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]';
const dayMessageClassName = 'py-6 text-center text-sm text-[#aebac8]';

function RecurringDayToolbar({
  date,
  today,
  onDateChange,
}: {
  date: LocalDateString;
  today: LocalDateString;
  onDateChange: (date: LocalDateString) => void;
}) {
  const { dictionary, locale } = useAppContext();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconButton
        aria-label={dictionary.recurring.previousDay}
        size="compact"
        className={dayArrowClassName}
        onClick={() => onDateChange(addLocalDays(date, -1))}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </IconButton>
      <p
        aria-live="polite"
        className="min-w-0 flex-1 text-center text-sm font-semibold first-letter:uppercase text-[#fff9f2]"
      >
        {formatRecurringDate(date, locale)}
      </p>
      <IconButton
        aria-label={dictionary.recurring.nextDay}
        size="compact"
        className={dayArrowClassName}
        onClick={() => onDateChange(addLocalDays(date, 1))}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </IconButton>
      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className={dayActionClassName}
          onClick={() => onDateChange(today)}
        >
          {dictionary.calendar.today}
        </button>
        <button
          type="button"
          className={dayActionClassName}
          onClick={() => setIsPickerOpen(true)}
        >
          <CalendarDays aria-hidden="true" className="size-4" />
          {dictionary.recurring.chooseDate}
        </button>
        <Link
          href={`/calendar?day=${date}&from=recurring`}
          className={dayActionClassName}
        >
          {dictionary.recurring.openDailyTasks}
        </Link>
      </div>
      {isPickerOpen ? (
        <RecurringDateDialog
          date={date}
          today={today}
          onClose={() => setIsPickerOpen(false)}
          onConfirm={(nextDate) => {
            onDateChange(nextDate);
            setIsPickerOpen(false);
          }}
        />
      ) : null}
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

function RecurringOccurrenceList({
  canAnswer,
  occurrences,
  onAnswer,
}: {
  canAnswer: boolean;
  occurrences: RecurrenceOccurrence[] | undefined;
  onAnswer: RecurringAnswerHandler;
}) {
  const { dictionary, scope } = useAppContext();
  const categoryTags = useCategoryTags(scope, 'recurrence');
  const categoryTagMap = useMemo(
    () => new Map(categoryTags.map((tag) => [tag.id, tag])),
    [categoryTags],
  );

  if (occurrences === undefined) {
    return (
      <p aria-busy="true" className={dayMessageClassName}>
        {dictionary.recurring.loading}
      </p>
    );
  }

  if (occurrences.length === 0) {
    return (
      <p className={dayMessageClassName}>{dictionary.recurring.dayEmpty}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {occurrences.map((occurrence) => (
        <RecurringOccurrence
          key={occurrence.recurrence.id}
          canAnswer={canAnswer}
          categoryTagMap={categoryTagMap}
          occurrence={occurrence}
          onAnswer={onAnswer}
        />
      ))}
    </div>
  );
}

export function RecurringDayView({
  date,
  recurrences,
  responses,
  today,
  onDateChange,
}: {
  date: LocalDateString;
  recurrences: Recurrence[] | undefined;
  responses: RecurrenceResponse[] | undefined;
  today: LocalDateString;
  onDateChange: (date: LocalDateString) => void;
}) {
  const { dictionary } = useAppContext();
  const handleAnswer = useRecurringAnswer(today);
  const occurrences = useMemo(
    () =>
      recurrences && responses
        ? getOccurrencesForDate({ date, recurrences, responses })
        : undefined,
    [date, recurrences, responses],
  );
  const canAnswer = canRespondOnDate(date, today);

  return (
    <section
      aria-label={dictionary.recurring.dayTitle}
      className="flex min-w-0 flex-col gap-3"
    >
      <RecurringDayToolbar
        date={date}
        today={today}
        onDateChange={onDateChange}
      />
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
    </section>
  );
}
