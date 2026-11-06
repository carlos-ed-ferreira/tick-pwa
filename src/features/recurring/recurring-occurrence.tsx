'use client';

import { Check, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  IconButton,
  TaskTreeCategoryChip,
  TaskTreeCollapseButton,
  TaskTreeRowLayout,
} from '@/components/app';
import {
  buildVisibleTreeRows,
  type RecurrenceChild,
  type RecurrenceOccurrence,
  type RecurrenceResponseStatus,
} from '@/lib/domain';
import { useAppContext } from '@/providers';

const answerToneClassNames: Record<RecurrenceResponseStatus, string> = {
  done: 'bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/30 hover:text-emerald-50',
  not_done:
    'bg-rose-400/20 text-rose-100 hover:bg-rose-400/30 hover:text-rose-50',
};

const answerIdleClassName =
  'text-[#aebac8] hover:bg-white/[0.08] hover:text-[#fff9f2]';

export type RecurringAnswerHandler = (
  occurrence: RecurrenceOccurrence,
  itemId: string | null,
  status: RecurrenceResponseStatus | null,
) => void;

type RowAnswerHandler = (status: RecurrenceResponseStatus | null) => void;

function AnswerButton({
  canAnswer,
  label,
  name,
  status,
  value,
  onAnswer,
}: {
  canAnswer: boolean;
  label: string;
  name: string;
  status: RecurrenceResponseStatus | null;
  value: RecurrenceResponseStatus;
  onAnswer: RowAnswerHandler;
}) {
  const { dictionary } = useAppContext();
  const Icon = value === 'done' ? Check : X;
  const isActive = status === value;

  return (
    <IconButton
      aria-label={dictionary.recurring.answerLabel
        .replace('{status}', label)
        .replace('{name}', name)}
      aria-pressed={isActive}
      size="compact"
      tooltip={label}
      className={`rounded-full focus-visible:outline-[#f0c38e] ${
        isActive ? answerToneClassNames[value] : answerIdleClassName
      }`}
      disabled={!canAnswer}
      onClick={() => onAnswer(isActive ? null : value)}
    >
      <Icon aria-hidden="true" className="size-4" />
    </IconButton>
  );
}

function RecurringRow({
  bold,
  canAnswer,
  category,
  depth,
  hasChildren,
  isCollapsed,
  isPriority,
  name,
  status,
  onAnswer,
  onToggleCollapsed,
}: {
  bold: boolean;
  canAnswer: boolean;
  category?: { colorHex: string; name: string };
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  isPriority: boolean;
  name: string;
  status: RecurrenceResponseStatus | null;
  onAnswer: RowAnswerHandler;
  onToggleCollapsed: () => void;
}) {
  const { dictionary } = useAppContext();
  const answerProps = { canAnswer, name, status, onAnswer };

  return (
    <TaskTreeRowLayout
      categoryColorHex={category?.colorHex}
      depth={depth}
      isPriority={isPriority}
    >
      <TaskTreeCollapseButton
        collapseLabel={dictionary.dayEditor.collapseItem}
        expandLabel={dictionary.dayEditor.expandItem}
        hasChildren={hasChildren}
        isCollapsed={isCollapsed}
        onClick={onToggleCollapsed}
      />
      <span
        className={`min-w-0 flex-1 px-2 py-1 text-sm whitespace-pre-wrap wrap-anywhere text-[#fff9f2] touch:order-last touch:basis-full ${
          bold ? 'font-bold' : ''
        }`}
      >
        {name}
      </span>
      {category ? (
        <TaskTreeCategoryChip
          colorHex={category.colorHex}
          name={category.name}
        />
      ) : null}
      <span className="ml-1 flex shrink-0 items-center gap-1 touch:ml-auto">
        <AnswerButton
          {...answerProps}
          label={dictionary.recurring.done}
          value="done"
        />
        <AnswerButton
          {...answerProps}
          label={dictionary.recurring.notDone}
          value="not_done"
        />
      </span>
    </TaskTreeRowLayout>
  );
}

function RecurringChildRows({
  canAnswer,
  childItems,
  statuses,
  onAnswer,
}: {
  canAnswer: boolean;
  childItems: RecurrenceChild[];
  statuses: Record<string, RecurrenceResponseStatus>;
  onAnswer: (itemId: string, status: RecurrenceResponseStatus | null) => void;
}) {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const rows = useMemo(
    () =>
      buildVisibleTreeRows(
        childItems.map((child) => ({
          ...child,
          collapsed: collapsedIds.has(child.id),
        })),
      ),
    [childItems, collapsedIds],
  );

  function toggleCollapsed(itemId: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);

      if (!next.delete(itemId)) {
        next.add(itemId);
      }

      return next;
    });
  }

  return rows.map(({ depth, hasChildren, item }) => (
    <RecurringRow
      key={item.id}
      bold={item.bold}
      canAnswer={canAnswer}
      depth={depth + 1}
      hasChildren={hasChildren}
      isCollapsed={item.collapsed}
      isPriority={item.priority}
      name={item.text}
      status={statuses[item.id] ?? null}
      onAnswer={(status) => onAnswer(item.id, status)}
      onToggleCollapsed={() => toggleCollapsed(item.id)}
    />
  ));
}

export function RecurringOccurrence({
  canAnswer,
  categoryTagMap,
  occurrence,
  onAnswer,
}: {
  canAnswer: boolean;
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  occurrence: RecurrenceOccurrence;
  onAnswer: RecurringAnswerHandler;
}) {
  const { content } = occurrence;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const category = categoryTagMap.get(content.categoryTagId ?? '');

  return (
    <div role="group" aria-label={content.text} className="grid gap-1">
      <RecurringRow
        bold={content.bold}
        canAnswer={canAnswer}
        category={category}
        depth={0}
        hasChildren={content.children.length > 0}
        isCollapsed={isCollapsed}
        isPriority={content.priority}
        name={content.text}
        status={occurrence.status}
        onAnswer={(status) => onAnswer(occurrence, null, status)}
        onToggleCollapsed={() => setIsCollapsed((current) => !current)}
      />
      {isCollapsed ? null : (
        <RecurringChildRows
          canAnswer={canAnswer}
          childItems={content.children}
          statuses={occurrence.childStatuses}
          onAnswer={(itemId, status) => onAnswer(occurrence, itemId, status)}
        />
      )}
    </div>
  );
}
