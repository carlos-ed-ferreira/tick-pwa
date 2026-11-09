'use client';

import { useMemo, useState } from 'react';
import type {
  LocalDateString,
  Recurrence,
  RecurrenceResponse,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import { RecurringDayBody } from './recurring-day-view';
import { RecurringEditorDialog } from './recurring-editor-dialog';
import { RecurringEmptyState } from './recurring-empty-state';
import {
  RecurringActivitiesList,
  RecurringManageActions,
} from './recurring-activities';
import { RecurringPerformanceView } from './recurring-performance';
import { RecurringPerformanceDetail } from './recurring-performance-detail';
import { RecurringViewTabs, type RecurringView } from './recurring-view-tabs';
import {
  usePerformanceFilters,
  type PerformanceFilters,
} from './use-performance-filters';
import {
  useRecurringLocation,
  type RecurringLocation,
} from './use-recurring-location';
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

function RecurringWorkspaceBody({
  date,
  filters,
  location,
  navigate,
  onDateChange,
  recurrences,
  responses,
  responsesByRecurrence,
  today,
  onEdit,
}: {
  date: LocalDateString;
  filters: PerformanceFilters;
  location: RecurringLocation;
  navigate: (location: RecurringLocation) => void;
  onDateChange: (date: LocalDateString) => void;
  recurrences: Recurrence[];
  responses: RecurrenceResponse[];
  responsesByRecurrence: Map<string, RecurrenceResponse[]>;
  today: LocalDateString;
  onEdit: (recurrence: Recurrence) => void;
}) {
  if (location.view === 'execute') {
    return (
      <RecurringDayBody
        date={date}
        recurrences={recurrences}
        responses={responses}
        today={today}
        onDateChange={onDateChange}
      />
    );
  }

  if (location.view === 'activities') {
    return (
      <RecurringActivitiesList
        recurrences={recurrences}
        responsesByRecurrence={responsesByRecurrence}
        today={today}
        onEdit={onEdit}
      />
    );
  }

  const selected = recurrences.find(
    (recurrence) => recurrence.id === location.activityId,
  );

  return selected ? (
    <RecurringPerformanceDetail
      filters={filters}
      recurrence={selected}
      responses={responsesByRecurrence.get(selected.id) ?? []}
      today={today}
      onBack={() => navigate({ activityId: null, view: 'performance' })}
    />
  ) : (
    <RecurringPerformanceView
      filters={filters}
      recurrences={recurrences}
      responsesByRecurrence={responsesByRecurrence}
      today={today}
      onOpen={(activityId) => navigate({ activityId, view: 'performance' })}
    />
  );
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
  const { location, navigate } = useRecurringLocation();
  const filters = usePerformanceFilters(today);
  const { view } = location;
  const date = pickedDate ?? today;
  const regionLabels: Record<RecurringView, string> = {
    activities: labels.overviewTitle,
    execute: labels.dayTitle,
    performance: labels.performanceTitle,
  };

  return (
    <section
      aria-label={regionLabels[view]}
      className="flex min-w-0 flex-col gap-3 pt-4 sm:pt-5 lg:pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RecurringViewTabs
          view={view}
          onChange={(next) => navigate({ activityId: null, view: next })}
        />
        {view === 'activities' ? (
          <RecurringManageActions onCreate={onCreate} />
        ) : null}
      </div>
      <RecurringWorkspaceBody
        date={date}
        filters={filters}
        location={location}
        navigate={navigate}
        recurrences={recurrences}
        onDateChange={(next) => setPickedDate(next === today ? null : next)}
        responses={responses}
        responsesByRecurrence={responsesByRecurrence}
        today={today}
        onEdit={onEdit}
      />
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
