'use client';

import { Check, Eraser, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { Dialog, FormField, ModalActionButton, Tooltip } from '@/components/ui';
import {
  getQuantityOutcome,
  getQuantityProgress,
  parseQuantityInput,
  type RecurrenceMeasure,
  type RecurrenceQuantity,
} from '@/lib/domain';
import { formatQuantity } from '@/lib/i18n';
import { useAppContext } from '@/providers';
import {
  PerformanceBar,
  performanceStatusAppearance,
} from './recurring-performance-parts';

export type RecordQuantityHandler = (value: number | null) => void;

const statusByOutcome = {
  done: 'done',
  partial: 'partial',
  zero: 'not_done',
} as const;

function useQuantityText(
  measure: RecurrenceMeasure,
  quantity: RecurrenceQuantity | null,
) {
  const { dictionary, locale } = useAppContext();
  const labels = dictionary.recurring;
  const target = quantity?.target ?? measure.target;
  const unit = quantity?.unit ?? measure.unit;

  return labels.quantityProgress
    .replace('{value}', quantity ? formatQuantity(quantity.value, locale) : '—')
    .replace('{target}', formatQuantity(target, locale))
    .replace('{unit}', unit);
}

function useQuantityForm({
  quantity,
  onClose,
  onRecord,
}: {
  quantity: RecurrenceQuantity | null;
  onClose: () => void;
  onRecord: RecordQuantityHandler;
}) {
  const { dictionary, locale } = useAppContext();
  const [input, setInput] = useState(
    quantity ? formatQuantity(quantity.value, locale) : '',
  );
  const [error, setError] = useState<string | null>(null);

  function record(value: number | null) {
    onRecord(value);
    onClose();
  }

  return {
    change(value: string) {
      setInput(value);
      setError(null);
    },
    error,
    input,
    record,
    save() {
      const value = parseQuantityInput(input);

      if (value === null) {
        setError(dictionary.recurring.quantityInvalid);
        return;
      }

      record(value);
    },
  };
}

function QuantityExcessNote({
  quantity,
}: {
  quantity: RecurrenceQuantity | null;
}) {
  const { dictionary, locale } = useAppContext();

  if (!quantity || quantity.value <= quantity.target) {
    return null;
  }

  return (
    <p className="px-1 text-xs text-emerald-200">
      {dictionary.recurring.quantityExcess
        .replace(
          '{value}',
          formatQuantity(quantity.value - quantity.target, locale),
        )
        .replace('{unit}', quantity.unit)}
    </p>
  );
}

function QuantityDialogActions({
  canClear,
  onComplete,
  onRecord,
}: {
  canClear: boolean;
  onComplete: () => void;
  onRecord: (value: number | null) => void;
}) {
  const labels = useAppContext().dictionary.recurring;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ModalActionButton tone="neutral" onClick={onComplete}>
        <Check aria-hidden="true" className="size-3.5" />
        {labels.quantityComplete}
      </ModalActionButton>
      <ModalActionButton tone="neutral" onClick={() => onRecord(0)}>
        <X aria-hidden="true" className="size-3.5" />
        {labels.quantityZero}
      </ModalActionButton>
      {canClear ? (
        <ModalActionButton tone="neutral" onClick={() => onRecord(null)}>
          <Eraser aria-hidden="true" className="size-3.5" />
          {labels.quantityClear}
        </ModalActionButton>
      ) : null}
      <ModalActionButton className="ml-auto" tone="accent" type="submit">
        <Check aria-hidden="true" className="size-3.5" />
        {labels.save}
      </ModalActionButton>
    </div>
  );
}

function QuantityDialog({
  measure,
  name,
  quantity,
  onClose,
  onRecord,
}: {
  measure: RecurrenceMeasure;
  name: string;
  quantity: RecurrenceQuantity | null;
  onClose: () => void;
  onRecord: RecordQuantityHandler;
}) {
  const { dictionary, locale } = useAppContext();
  const labels = dictionary.recurring;
  const target = quantity?.target ?? measure.target;
  const unit = quantity?.unit ?? measure.unit;
  const form = useQuantityForm({ quantity, onClose, onRecord });

  return (
    <Dialog
      closeLabel={dictionary.actions.cancel}
      open
      size="sheet"
      title={name}
      onClose={onClose}
    >
      <form
        noValidate
        className="flex flex-col gap-4 p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          form.save();
        }}
      >
        <p className="px-1 text-sm text-[#cbd5e0]">
          {labels.measureSummary
            .replace('{target}', formatQuantity(target, locale))
            .replace('{unit}', unit)}
        </p>
        <FormField
          autoComplete="off"
          autoFocus
          error={form.error}
          inputMode="decimal"
          label={labels.quantityFieldLabel}
          value={form.input}
          endAdornment={
            <span className="pr-3 text-sm text-[#aebac8]">{unit}</span>
          }
          onChange={(event) => form.change(event.target.value)}
        />
        <QuantityExcessNote quantity={quantity} />
        <QuantityDialogActions
          canClear={quantity !== null}
          onRecord={form.record}
          onComplete={() => form.record(Math.max(quantity?.value ?? 0, target))}
        />
      </form>
    </Dialog>
  );
}

export function QuantityAnswer({
  canAnswer,
  measure,
  name,
  quantity,
  onRecord,
}: {
  canAnswer: boolean;
  measure: RecurrenceMeasure;
  name: string;
  quantity: RecurrenceQuantity | null;
  onRecord: RecordQuantityHandler;
}) {
  const labels = useAppContext().dictionary.recurring;
  const [isOpen, setIsOpen] = useState(false);
  const text = useQuantityText(measure, quantity);
  const progress = quantity
    ? Math.round(getQuantityProgress(quantity) * 100)
    : null;
  const status = quantity
    ? statusByOutcome[getQuantityOutcome(quantity)]
    : null;
  const appearance = status ? performanceStatusAppearance[status] : null;

  return (
    <>
      <span className="flex w-40 shrink-0 items-center gap-2 touch:w-16">
        <PerformanceBar
          label={labels.quantityProgressLabel.replace('{name}', name)}
          name={name}
          rate={progress}
        />
      </span>
      <Tooltip content={labels.recordQuantity}>
        <button
          type="button"
          disabled={!canAnswer}
          className="touch-target inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap text-[#e5ebf3] tabular-nums transition hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setIsOpen(true)}
        >
          <span className="sr-only">{labels.recordQuantity}: </span>
          {appearance ? (
            <appearance.Icon
              aria-hidden="true"
              className={`size-3.5 ${appearance.className}`}
            />
          ) : null}
          {text}
          {progress !== null ? (
            <span className="text-[#aebac8]">{`${progress}%`}</span>
          ) : null}
          <Pencil aria-hidden="true" className="size-3 text-[#aebac8]" />
        </button>
      </Tooltip>
      {isOpen ? (
        <QuantityDialog
          measure={measure}
          name={name}
          quantity={quantity}
          onClose={() => setIsOpen(false)}
          onRecord={onRecord}
        />
      ) : null}
    </>
  );
}
