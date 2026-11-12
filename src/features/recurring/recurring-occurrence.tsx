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
  getItemMeasure,
  type RecurrenceContent,
  type RecurrenceMeasure,
  type RecurrenceOccurrence,
  type RecurrenceQuantity,
  type RecurrenceResponseStatus,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import {
  QuantityAnswer,
  type RecordQuantityHandler,
} from './recurring-quantity-answer';

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

export type RecurringQuantityHandler = (
  occurrence: RecurrenceOccurrence,
  itemId: string | null,
  value: number | null,
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

function RowAnswerControls({
  canAnswer,
  measure,
  name,
  quantity,
  status,
  onAnswer,
  onRecordQuantity,
}: {
  canAnswer: boolean;
  measure: RecurrenceMeasure | null;
  name: string;
  quantity: RecurrenceQuantity | null;
  status: RecurrenceResponseStatus | null;
  onAnswer: RowAnswerHandler;
  onRecordQuantity: RecordQuantityHandler;
}) {
  const { dictionary } = useAppContext();
  const answerProps = { canAnswer, name, status, onAnswer };

  return (
    <span
      className={`ml-1 flex shrink-0 items-center gap-1 touch:ml-auto touch:gap-3 ${measure ? 'touch:ml-0 touch:w-full touch:px-2' : ''}`}
    >
      {measure ? (
        <QuantityAnswer
          canAnswer={canAnswer}
          measure={measure}
          name={name}
          quantity={quantity}
          onRecord={onRecordQuantity}
        />
      ) : (
        <>
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
        </>
      )}
    </span>
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
  measure,
  name,
  quantity,
  status,
  onAnswer,
  onRecordQuantity,
  onToggleCollapsed,
}: {
  bold: boolean;
  canAnswer: boolean;
  category?: { colorHex: string; name: string };
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  isPriority: boolean;
  measure: RecurrenceMeasure | null;
  name: string;
  quantity: RecurrenceQuantity | null;
  status: RecurrenceResponseStatus | null;
  onAnswer: RowAnswerHandler;
  onRecordQuantity: RecordQuantityHandler;
  onToggleCollapsed: () => void;
}) {
  const { dictionary } = useAppContext();

  return (
    <TaskTreeRowLayout
      categoryColorHex={category?.colorHex}
      className="touch:flex-wrap touch:gap-y-1 touch:px-2 touch:py-2"
      depth={depth}
      isPriority={isPriority}
    >
      <div className={hasChildren ? 'contents' : 'contents touch:hidden'}>
        <TaskTreeCollapseButton
          collapseLabel={dictionary.dayEditor.collapseItem}
          expandLabel={dictionary.dayEditor.expandItem}
          hasChildren={hasChildren}
          isCollapsed={isCollapsed}
          onClick={onToggleCollapsed}
        />
      </div>
      <OccurrenceIdentity name={name} bold={bold} category={category} />
      <RowAnswerControls
        canAnswer={canAnswer}
        measure={measure}
        name={name}
        quantity={quantity}
        status={status}
        onAnswer={onAnswer}
        onRecordQuantity={onRecordQuantity}
      />
    </TaskTreeRowLayout>
  );
}

function OccurrenceIdentity({
  name,
  bold,
  category,
}: {
  name: string;
  bold: boolean;
  category?: { colorHex: string; name: string };
}) {
  return (
    <div className="contents touch:flex touch:min-w-0 touch:flex-1 touch:items-center touch:justify-between touch:gap-2 touch:pl-2">
      <span
        className={`min-w-0 flex-1 px-2 py-1 text-sm whitespace-pre-wrap wrap-anywhere text-[#fff9f2] touch:px-0 touch:py-0 touch:text-base touch:leading-6 ${
          bold ? 'font-bold' : ''
        }`}
      >
        {name}
      </span>
      {category ? (
        <div className="contents touch:flex touch:min-w-0 touch:max-w-[45%] touch:shrink-0">
          <TaskTreeCategoryChip
            colorHex={category.colorHex}
            name={category.name}
          />
        </div>
      ) : null}
    </div>
  );
}

function RecurringChildRows({
  canAnswer,
  content,
  quantities,
  statuses,
  onAnswer,
  onRecordQuantity,
}: {
  canAnswer: boolean;
  content: RecurrenceContent;
  quantities: Record<string, RecurrenceQuantity>;
  statuses: Record<string, RecurrenceResponseStatus>;
  onAnswer: (itemId: string, status: RecurrenceResponseStatus | null) => void;
  onRecordQuantity: (itemId: string, value: number | null) => void;
}) {
  const childItems = content.children;
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
      measure={getItemMeasure(content, item.id)}
      name={item.text}
      quantity={quantities[item.id] ?? null}
      status={statuses[item.id] ?? null}
      onAnswer={(status) => onAnswer(item.id, status)}
      onRecordQuantity={(value) => onRecordQuantity(item.id, value)}
      onToggleCollapsed={() => toggleCollapsed(item.id)}
    />
  ));
}

export function RecurringOccurrence({
  canAnswer,
  categoryTagMap,
  occurrence,
  onAnswer,
  onRecordQuantity,
}: {
  canAnswer: boolean;
  categoryTagMap: Map<string, { colorHex: string; name: string }>;
  occurrence: RecurrenceOccurrence;
  onAnswer: RecurringAnswerHandler;
  onRecordQuantity: RecurringQuantityHandler;
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
        measure={getItemMeasure(content, null)}
        name={content.text}
        quantity={occurrence.quantity}
        status={occurrence.status}
        onAnswer={(status) => onAnswer(occurrence, null, status)}
        onRecordQuantity={(value) => onRecordQuantity(occurrence, null, value)}
        onToggleCollapsed={() => setIsCollapsed((current) => !current)}
      />
      {isCollapsed ? null : (
        <RecurringChildRows
          canAnswer={canAnswer}
          content={content}
          quantities={occurrence.childQuantities}
          statuses={occurrence.childStatuses}
          onAnswer={(itemId, status) => onAnswer(occurrence, itemId, status)}
          onRecordQuantity={(itemId, value) =>
            onRecordQuantity(occurrence, itemId, value)
          }
        />
      )}
    </div>
  );
}
