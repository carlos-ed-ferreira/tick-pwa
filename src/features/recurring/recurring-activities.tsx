'use client';

import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { TaskTreeCategoryTabs } from '@/components/app';
import {
  Input,
  filledAccentPillControlClassName,
  filledMediumPillControlClassName,
  taskListSurfaceClassName,
} from '@/components/ui';
import { CategoryManagerAction } from '@/features/categories';
import {
  ALL_CATEGORY_TAB_ID,
  isRecurrencePaused,
  type LocalDateString,
  type Recurrence,
  type RecurrenceResponse,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import { RecurrenceActionsMenu } from './recurrence-actions-menu';
import { RecurringPillGroup } from './recurring-pill-group';
import {
  RecurrenceIdentity,
  RecurringRowSurface,
  type RecurrenceCategory,
} from './recurring-row';
import { useRecurrenceCategoryFilter } from './use-recurrence-category-filter';

type StatusFilter = 'all' | 'active' | 'paused';

const messageClassName = 'py-6 text-center text-sm text-[#aebac8]';

function RecurringManageActions({ onCreate }: { onCreate: () => void }) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CategoryManagerAction
        className={filledMediumPillControlClassName}
        surface="recurrence"
        title={labels.categoriesTitle}
      />
      <button
        type="button"
        className={filledAccentPillControlClassName}
        onClick={onCreate}
      >
        <Plus aria-hidden="true" className="size-4" />
        {labels.newActivity}
      </button>
    </div>
  );
}

function ActivityRow({
  category,
  recurrence,
  responses,
  today,
  onEdit,
}: {
  category?: RecurrenceCategory;
  recurrence: Recurrence;
  responses: RecurrenceResponse[];
  today: LocalDateString;
  onEdit: (recurrence: Recurrence) => void;
}) {
  return (
    <RecurringRowSurface
      className="py-2 pr-1.5 pl-3"
      isPriority={recurrence.priority}
    >
      <RecurrenceIdentity category={category} recurrence={recurrence} />
      <RecurrenceActionsMenu
        answerCount={responses.length}
        recurrence={recurrence}
        today={today}
        onEdit={onEdit}
      />
    </RecurringRowSurface>
  );
}

function compareActivities(left: Recurrence, right: Recurrence): number {
  return (
    Number(isRecurrencePaused(left.schedule)) -
      Number(isRecurrencePaused(right.schedule)) ||
    left.createdAt.localeCompare(right.createdAt)
  );
}

function matchesStatus(recurrence: Recurrence, status: StatusFilter): boolean {
  if (status === 'all') {
    return true;
  }

  return isRecurrencePaused(recurrence.schedule) === (status === 'paused');
}

function StatusFilterTabs({
  status,
  onChange,
}: {
  status: StatusFilter;
  onChange: (status: StatusFilter) => void;
}) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <RecurringPillGroup
      label={labels.statusFilterLabel}
      options={[
        { label: labels.filterAll, value: 'all' },
        { label: labels.filterActive, value: 'active' },
        { label: labels.filterPaused, value: 'paused' },
      ]}
      value={status}
      onChange={onChange}
    />
  );
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <label className="flex h-9 w-64 min-w-0 items-center gap-2 rounded-full bg-white/6 px-3 text-sm text-[#cbd5e0] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#f0c38e] touch:w-full">
      <Search aria-hidden="true" className="size-4 shrink-0" />
      <Input
        aria-label={labels.searchLabel}
        className="min-w-0 flex-1 bg-transparent text-[#fff9f2] outline-none placeholder:text-[#7b8da0]"
        placeholder={labels.searchLabel}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ActivitiesToolbar({
  activeTabId,
  query,
  status,
  tabs,
  onCategoryChange,
  onCreate,
  onQueryChange,
  onStatusChange,
}: {
  activeTabId: string | null;
  query: string;
  status: StatusFilter;
  tabs: ReturnType<typeof useRecurrenceCategoryFilter>['tabs'];
  onCategoryChange: (tabId: string) => void;
  onCreate: () => void;
  onQueryChange: (query: string) => void;
  onStatusChange: (status: StatusFilter) => void;
}) {
  const { dictionary } = useAppContext();

  return (
    <div className="flex flex-col gap-2 pb-1">
      <div className="flex flex-wrap items-center gap-2">
        <StatusFilterTabs status={status} onChange={onStatusChange} />
        <SearchField value={query} onChange={onQueryChange} />
        <div className="ml-auto touch:ml-0">
          <RecurringManageActions onCreate={onCreate} />
        </div>
      </div>
      {tabs.length > 0 ? (
        <TaskTreeCategoryTabs
          activeTabId={activeTabId}
          label={dictionary.calendar.categoryTabs}
          tabs={tabs}
          onSelect={onCategoryChange}
        />
      ) : null}
    </div>
  );
}

export function RecurringActivitiesList({
  recurrences,
  responsesByRecurrence,
  today,
  onCreate,
  onEdit,
}: {
  recurrences: Recurrence[];
  responsesByRecurrence: Map<string, RecurrenceResponse[]>;
  today: LocalDateString;
  onCreate: () => void;
  onEdit: (recurrence: Recurrence) => void;
}) {
  const { dictionary } = useAppContext();
  const labels = dictionary.recurring;
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [categoryTabId, setCategoryTabId] = useState(ALL_CATEGORY_TAB_ID);
  const categories = useRecurrenceCategoryFilter(recurrences, categoryTabId);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = categories.visible
    .filter((recurrence) => matchesStatus(recurrence, status))
    .filter((recurrence) =>
      recurrence.text.toLocaleLowerCase().includes(normalizedQuery),
    )
    .sort(compareActivities);

  function clearFilters() {
    setStatus('all');
    setQuery('');
    setCategoryTabId(ALL_CATEGORY_TAB_ID);
  }

  return (
    <div
      data-testid="task-list-surface"
      className={`flex flex-col gap-2 ${taskListSurfaceClassName}`}
    >
      <ActivitiesToolbar
        activeTabId={categories.activeTabId}
        query={query}
        status={status}
        tabs={categories.tabs}
        onCategoryChange={setCategoryTabId}
        onCreate={onCreate}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
      />
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className={messageClassName}>{labels.noMatches}</p>
          <button
            type="button"
            className={filledMediumPillControlClassName}
            onClick={clearFilters}
          >
            {labels.clearFilters}
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5">
          {visible.map((recurrence) => (
            <ActivityRow
              key={recurrence.id}
              category={categories.categoryTagMap.get(
                recurrence.categoryTagId ?? '',
              )}
              recurrence={recurrence}
              responses={responsesByRecurrence.get(recurrence.id) ?? []}
              today={today}
              onEdit={onEdit}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
