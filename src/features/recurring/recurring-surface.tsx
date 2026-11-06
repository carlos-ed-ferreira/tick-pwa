'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  isCalendarDate,
  type LocalDateString,
  type Recurrence,
  type RecurrenceResponse,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import { RecurringDayView } from './recurring-day-view';
import { RecurringEditorDialog } from './recurring-editor-dialog';
import { RecurringOverview } from './recurring-overview';
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

export function RecurringSurface() {
  const { scope, timezonePreference } = useAppContext();
  const addressDate = useSearchParams()?.get('date');
  const today = useTodayKey(timezonePreference.timezone);
  const [pickedDate, setPickedDate] = useState<LocalDateString | null>(
    isCalendarDate(addressDate) ? addressDate : null,
  );
  const [editor, setEditor] = useState<EditorTarget>(null);
  const recurrences = useRecurrences(scope);
  const responses = useRecurrenceResponses(scope);
  const responsesByRecurrence = useMemo(
    () => groupResponses(responses),
    [responses],
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <RecurringDayView
        date={pickedDate ?? today}
        recurrences={recurrences}
        responses={responses}
        today={today}
        onDateChange={(date) => setPickedDate(date === today ? null : date)}
      />
      <RecurringOverview
        recurrences={recurrences}
        responsesByRecurrence={responsesByRecurrence}
        today={today}
        onCreate={() => setEditor({ recurrence: null })}
        onEdit={(recurrence) => setEditor({ recurrence })}
      />
      {editor ? (
        <RecurringEditorDialog
          key={editor.recurrence?.id ?? 'new'}
          hasAnswers={
            editor.recurrence !== null &&
            responsesByRecurrence.has(editor.recurrence.id)
          }
          recurrence={editor.recurrence}
          today={today}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </div>
  );
}
