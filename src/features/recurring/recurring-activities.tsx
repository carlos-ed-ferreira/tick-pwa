'use client';

import { Plus, Search, Star } from 'lucide-react';
import { useState } from 'react';
import { TaskTreeCategoryChip, TaskTreeCategoryTabs } from '@/components/app';
import {
  Input,
  Tooltip,
  filledAccentPillControlClassName,
  filledMediumPillControlClassName,
  taskListSurfaceClassName,
} from '@/components/ui';
import { CategoryManagerAction, useCategoryTags } from '@/features/categories';
import {
  ALL_CATEGORY_TAB_ID,
  buildCategoryTabs,
  filterRowsByCategoryTab,
  isRecurrencePaused,
  resolveActiveCategoryTab,
  type CategoryTag,
  type LocalDateString,
  type Recurrence,
  type RecurrenceResponse,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import { RecurrenceActions } from './recurrence-actions';
import { formatRecurrenceFrequency } from './recurrence-format';
import { RecurringPillGroup } from './recurring-pill-group';

type StatusFilter = 'all' | 'active' | 'paused';

const messageClassName = 'py-6 text-center text-sm text-[#aebac8]';

export function RecurringManageActions({ onCreate }: { onCreate: () => void }) {
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

export function RecurrenceNameLine({
  category,
  recurrence,
}: {
  category?: { colorHex: string; name: string };
  recurrence: Recurrence;
}) {
  const { dictionary } = useAppContext();

  return (
    <div className="flex min-w-0 items-center gap-2">
      {recurrence.priority ? (
        <Star
          aria-label={dictionary.recurring.priority}
          className="size-3.5 shrink-0 fill-[#f0c38e] text-[#f0c38e]"
          role="img"
        />
      ) : null}
      <Tooltip className="min-w-0" content={recurrence.text} whenTruncated>
        <span
          className={`min-w-0 truncate text-sm text-[#fff9f2] ${
            recurrence.bold ? 'font-bold' : 'font-medium'
          }`}
        >
          {recurrence.text}
        </span>
      </Tooltip>
      {category ? (
        <TaskTreeCategoryChip
          colorHex={category.colorHex}
          name={category.name}
        />
      ) : null}
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
  category?: { colorHex: string; name: string };
  recurrence: Recurrence;
  responses: RecurrenceResponse[];
  today: LocalDateString;
  onEdit: (recurrence: Recurrence) => void;
}) {
  const { dictionary } = useAppContext();

  return (
    <li
      className={`relative rounded-lg py-2 pr-30 pl-3 transition hover:bg-white/[0.055] ${
        isRecurrencePaused(recurrence.schedule) ? 'opacity-70' : ''
      }`}
    >
      <RecurrenceNameLine category={category} recurrence={recurrence} />
      <p className="mt-0.5 truncate text-xs text-[#cbd5e0]">
        {formatRecurrenceFrequency(recurrence, dictionary)}
      </p>
      <span className="absolute top-1/2 right-2 -translate-y-1/2">
        <RecurrenceActions
          answerCount={responses.length}
          recurrence={recurrence}
          today={today}
          onEdit={onEdit}
        />
      </span>
    </li>
  );
}

export function useRecurrenceCategoryFilter(
  recurrences: readonly Recurrence[],
  requestedTabId: string,
) {
  const { dictionary, scope } = useAppContext();
  const categoryTags = useCategoryTags(scope, 'recurrence');
  const rows = recurrences.map((recurrence) => ({ depth: 0, recurrence }));
  const getCategoryTagId = (row: (typeof rows)[number]) =>
    row.recurrence.categoryTagId;
  const tabs = buildCategoryTabs({
    allLabel: dictionary.calendar.categoryTabAll,
    categoryTags,
    getCategoryTagId,
    rows,
    uncategorizedLabel: dictionary.calendar.categoryTabUncategorized,
  });
  const activeTab =
    tabs.length > 2 ? resolveActiveCategoryTab(tabs, requestedTabId) : null;
  const visible = activeTab
    ? filterRowsByCategoryTab({
        activeTabId: activeTab.id,
        getCategoryTagId,
        rows,
        tabs,
      }).map((row) => row.recurrence)
    : [...recurrences];

  return {
    activeTabId: activeTab?.id ?? null,
    categoryTagMap: new Map<string, CategoryTag>(
      categoryTags.map((tag) => [tag.id, tag]),
    ),
    tabs: activeTab ? tabs : [],
    visible,
  };
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
    <label className="flex h-9 min-w-0 flex-1 basis-48 items-center gap-2 rounded-full bg-white/8 px-3 text-sm text-[#cbd5e0] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#f0c38e] sm:max-w-xs">
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

export function RecurringActivitiesList({
  recurrences,
  responsesByRecurrence,
  today,
  onEdit,
}: {
  recurrences: Recurrence[];
  responsesByRecurrence: Map<string, RecurrenceResponse[]>;
  today: LocalDateString;
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
      <div className="flex flex-wrap items-center gap-2">
        <StatusFilterTabs status={status} onChange={setStatus} />
        <SearchField value={query} onChange={setQuery} />
      </div>
      {categories.tabs.length > 0 ? (
        <TaskTreeCategoryTabs
          activeTabId={categories.activeTabId}
          label={dictionary.calendar.categoryTabs}
          tabs={categories.tabs}
          onSelect={setCategoryTabId}
        />
      ) : null}
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
        <ul className="grid grid-cols-1 gap-1">
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
