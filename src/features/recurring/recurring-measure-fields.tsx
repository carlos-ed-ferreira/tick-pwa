'use client';

import { Ruler } from 'lucide-react';
import { FormField } from '@/components/ui';
import type { RecurrenceMeasureError } from '@/lib/domain';
import { useAppContext } from '@/providers';
import type { BulkChecklistDraftItem } from '@/features/calendar/bulk-checklist-draft';
import type { MeasureDraft } from './recurrence-form';
import { RecurringTogglePill } from './recurring-toggle-pill';

const emptyDraft: MeasureDraft = { enabled: false, target: '', unit: '' };

function useMeasureErrorLabel() {
  const labels = useAppContext().dictionary.recurring;

  return (
    error: RecurrenceMeasureError | undefined,
    field: 'target' | 'unit',
  ) =>
    error === field
      ? field === 'target'
        ? labels.measureTargetInvalid
        : labels.measureUnitInvalid
      : null;
}

function MeasureInputs({
  draft,
  error,
  onChange,
}: {
  draft: MeasureDraft;
  error?: RecurrenceMeasureError;
  onChange: (draft: MeasureDraft) => void;
}) {
  const labels = useAppContext().dictionary.recurring;
  const errorLabel = useMeasureErrorLabel();

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
      <FormField
        autoComplete="off"
        error={errorLabel(error, 'target')}
        inputMode="decimal"
        label={labels.measureTargetLabel}
        value={draft.target}
        onChange={(event) => onChange({ ...draft, target: event.target.value })}
      />
      <FormField
        autoComplete="off"
        error={errorLabel(error, 'unit')}
        label={labels.measureUnitLabel}
        maxLength={24}
        placeholder={labels.measureUnitPlaceholder}
        value={draft.unit}
        onChange={(event) => onChange({ ...draft, unit: event.target.value })}
      />
    </div>
  );
}

export function RootMeasureFields({
  draft,
  error,
  hasChildren,
  showForwardNote,
  onChange,
}: {
  draft: MeasureDraft;
  error?: RecurrenceMeasureError;
  hasChildren: boolean;
  showForwardNote: boolean;
  onChange: (draft: MeasureDraft) => void;
}) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <section aria-label={labels.measureToggle} className="grid gap-3">
      <RecurringTogglePill
        active={draft.enabled}
        disabled={hasChildren && !draft.enabled}
        label={labels.measureToggle}
        onToggle={() => onChange({ ...draft, enabled: !draft.enabled })}
      >
        <Ruler aria-hidden="true" className="size-3.5" />
      </RecurringTogglePill>
      {hasChildren ? (
        <p
          role={draft.enabled ? 'alert' : undefined}
          className={`px-1 text-xs ${draft.enabled ? 'text-rose-300' : 'text-[#aebac8]'}`}
        >
          {labels.measureWithChildren}
        </p>
      ) : null}
      {draft.enabled ? (
        <MeasureInputs draft={draft} error={error} onChange={onChange} />
      ) : null}
      {showForwardNote ? (
        <p className="px-1 text-xs text-[#aebac8]">
          {labels.measureForwardNote}
        </p>
      ) : null}
    </section>
  );
}

function ChildMeasureRow({
  draft,
  error,
  isGroup,
  name,
  onChange,
}: {
  draft: MeasureDraft;
  error?: RecurrenceMeasureError;
  isGroup: boolean;
  name: string;
  onChange: (draft: MeasureDraft) => void;
}) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <li className="grid gap-2 rounded-lg bg-white/[0.035] px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 flex-1 text-sm wrap-anywhere text-[#fff9f2]">
          {name}
        </span>
        <RecurringTogglePill
          active={draft.enabled}
          label={labels.measureToggle}
          onToggle={() => onChange({ ...draft, enabled: !draft.enabled })}
        >
          <Ruler aria-hidden="true" className="size-3.5" />
        </RecurringTogglePill>
      </div>
      {isGroup && draft.enabled ? (
        <p role="alert" className="px-1 text-xs text-rose-300">
          {labels.measureNeedsLeaf.replace('{name}', name)}
        </p>
      ) : null}
      {draft.enabled && !isGroup ? (
        <MeasureInputs draft={draft} error={error} onChange={onChange} />
      ) : null}
    </li>
  );
}

export function ChildMeasureFields({
  drafts,
  errors,
  items,
  onChange,
}: {
  drafts: Readonly<Record<string, MeasureDraft>>;
  errors: Readonly<Record<string, RecurrenceMeasureError>>;
  items: readonly BulkChecklistDraftItem[];
  onChange: (itemId: string, draft: MeasureDraft) => void;
}) {
  const labels = useAppContext().dictionary.recurring;
  const named = items.filter((item) => item.text.trim());
  const rows = named.filter(
    (item) =>
      !items.some((child) => child.parentId === item.id) ||
      drafts[item.id]?.enabled,
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <section aria-label={labels.childMeasuresTitle} className="grid gap-2">
      <h3 className="px-1 text-[0.68rem] leading-4 font-semibold tracking-[0.24em] text-[#fff9f2]/90 uppercase">
        {labels.childMeasuresTitle}
      </h3>
      <ul className="grid gap-1.5">
        {rows.map((item) => (
          <ChildMeasureRow
            key={item.id}
            draft={drafts[item.id] ?? emptyDraft}
            error={errors[item.id]}
            isGroup={items.some((child) => child.parentId === item.id)}
            name={item.text.trim()}
            onChange={(draft) => onChange(item.id, draft)}
          />
        ))}
      </ul>
    </section>
  );
}
