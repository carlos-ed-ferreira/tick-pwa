'use client';

import { useMemo, useState } from 'react';
import type {
  LocalDateString,
  Recurrence,
  RecurrenceResponse,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import { RecurringDayBody, RecurringDayToolbar } from './recurring-day-view';
import { RecurringEditorDialog } from './recurring-editor-dialog';
import { RecurringEmptyState } from './recurring-empty-state';
import {
  RecurringManageActions,
  RecurringOverviewList,
} from './recurring-overview';
import { RecurringViewTabs, type RecurringView } from './recurring-view-tabs';
import { useRecurrenceResponses, useRecurrences } from './use-recurring-data';
import { useTodayKey } from './use-today-key';

type EditorTarget = { recurrence: Recurrence | null } | null;

function groupResponses(
  responses: readonly RecurrenceResponse[] | undefined,
): Map<string, RecurrenceResponse[]> {
  const grouped = new Map<string, RecurrenceResponse[]>();

  for (const response of responses ?? []) {
    const group = grouped.get(response.recurrenceId);

    if (group) {
      group.push(response);
    } else {
      grouped.set(response.recurrenceId, [response]);
    }
  }

  return grouped;
}

function RecurringWorkspace({
  recurrences,
  responses,
  responsesByRecurrence,
  today,
  onCreate,
  onEdit,
}: {
  recurrences: Recurrence[];
  responses: RecurrenceResponse[];
  responsesByRecurrence: Map<string, RecurrenceResponse[]>;
  today: LocalDateString;
  onCreate: () => void;
  onEdit: (recurrence: Recurrence) => void;
}) {
  const labels = useAppContext().dictionary.recurring;
  const [pickedDate, setPickedDate] = useState<LocalDateString | null>(null);
  const [view, setView] = useState<RecurringView>('execute');
  const isExecuting = view === 'execute';
  const date = pickedDate ?? today;

  return (
    <section
      aria-label={isExecuting ? labels.dayTitle : labels.overviewTitle}
      className="flex min-w-0 flex-col gap-3 pt-4 sm:pt-5 lg:pt-6"
    >
      <div
        className={
          isExecuting
            ? 'flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center'
            : 'flex flex-wrap items-center justify-between gap-2'
        }
      >
        <RecurringViewTabs view={view} onChange={setView} />
        {isExecuting ? (
          <RecurringDayToolbar
            date={date}
            onDateChange={(next) => setPickedDate(next === today ? null : next)}
          />
        ) : (
          <RecurringManageActions onCreate={onCreate} />
        )}
      </div>
      {isExecuting ? (
        <RecurringDayBody
          date={date}
          recurrences={recurrences}
          responses={responses}
          today={today}
        />
      ) : (
        <RecurringOverviewList
          recurrences={recurrences}
          responsesByRecurrence={responsesByRecurrence}
          today={today}
          onEdit={onEdit}
        />
      )}
    </section>
  );
}

export function RecurringSurface() {
  const { dictionary, scope, timezonePreference } = useAppContext();
  const today = useTodayKey(timezonePreference.timezone);
  const [editor, setEditor] = useState<EditorTarget>(null);
  const recurrences = useRecurrences(scope);
  const responses = useRecurrenceResponses(scope);
  const responsesByRecurrence = useMemo(
    () => groupResponses(responses),
    [responses],
  );

  if (!recurrences || !responses) {
    return (
      <p aria-busy="true" className="py-6 text-center text-sm text-[#aebac8]">
        {dictionary.recurring.loading}
      </p>
    );
  }

  const openCreate = () => setEditor({ recurrence: null });

  return (
    <>
      {recurrences.length === 0 ? (
        <RecurringEmptyState onCreate={openCreate} />
      ) : (
        <RecurringWorkspace
          recurrences={recurrences}
          responses={responses}
          responsesByRecurrence={responsesByRecurrence}
          today={today}
          onCreate={openCreate}
          onEdit={(recurrence) => setEditor({ recurrence })}
        />
      )}
      {editor ? (
        <RecurringEditorDialog
          key={editor.recurrence?.id ?? 'new'}
          hasAnswers={responsesByRecurrence.has(editor.recurrence?.id ?? '')}
          recurrence={editor.recurrence}
          today={today}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </>
  );
}
