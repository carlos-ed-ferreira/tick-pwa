'use client';

import { ArrowRightLeft, Copy, MoveRight, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Input, ModalActionButton } from '@/components/ui';
import type { LocalDateString } from '@/lib/domain';
import { formatLocalDateLabel } from '@/lib/i18n';
import { parseLocalDateKey } from '@/lib/time';
import { maskDateInput, parseDateInputValue } from '@/lib/time';
import { useAppContext } from '@/providers';

function createDateLabelDate(date: LocalDateString): Date {
  const parsedDate = parseLocalDateKey(date);

  return new Date(
    Date.UTC(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate(),
      12,
    ),
  );
}

export function CalendarTaskTransferAction({
  sourceDate,
  onDuplicateToDate,
  onMoveToDate,
}: {
  sourceDate: LocalDateString;
  onDuplicateToDate: (targetDate: LocalDateString) => Promise<void> | void;
  onMoveToDate: (targetDate: LocalDateString) => Promise<void> | void;
}) {
  const { dictionary, locale, timezonePreference } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [targetDateInput, setTargetDateInput] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const targetDateInputRef = useRef<HTMLInputElement | null>(null);
  const sourceDateLabel = useMemo(
    () =>
      formatLocalDateLabel(
        createDateLabelDate(sourceDate),
        locale,
        timezonePreference.timezone,
      ),
    [locale, sourceDate, timezonePreference.timezone],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    targetDateInputRef.current?.focus();
  }, [isOpen]);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setTargetDateInput('');
    setValidationMessage('');
    setIsSubmitting(false);
  }, []);

  async function handleTransfer(transfer: 'move' | 'duplicate'): Promise<void> {
    const targetDate = parseDateInputValue(targetDateInput);

    if (!targetDate) {
      setValidationMessage(dictionary.calendar.transferInvalidDate);
      return;
    }

    if (targetDate === sourceDate) {
      setValidationMessage(dictionary.calendar.transferSameDate);
      return;
    }

    setValidationMessage('');
    setIsSubmitting(true);

    try {
      if (transfer === 'move') {
        await onMoveToDate(targetDate);
      } else {
        await onDuplicateToDate(targetDate);
      }

      closeDialog();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        tone="subtle"
        aria-label={dictionary.calendar.transferItem}
        className="rounded-full border-white/10 bg-white/5 px-4 text-[#fff9f2] hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
        onClick={() => setIsOpen(true)}
      >
        <ArrowRightLeft aria-hidden="true" className="size-4" />
        <span>{dictionary.calendar.transferItem}</span>
      </Button>

      <Dialog
        closeLabel={dictionary.actions.cancel}
        panelClassName="sm:h-auto sm:max-w-xl"
        title={dictionary.calendar.transferDialogTitle}
        open={isOpen}
        onClose={closeDialog}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
          <p className="text-sm leading-6 text-[#bdb4d4]">
            {dictionary.calendar.transferDescription}
          </p>

          <div className="grid gap-1 rounded-xl bg-white/[0.035] px-3 py-2.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9f96b8]">
              {dictionary.calendar.title}
            </span>
            <span className="font-medium text-[#fff9f2]">
              {sourceDateLabel}
            </span>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9f96b8]">
              {dictionary.calendar.transferTargetDate}
            </span>
            <Input
              ref={targetDateInputRef}
              aria-label={dictionary.calendar.transferTargetDate}
              className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-[#fff9f2] outline-none transition placeholder:text-[#8f85aa] focus:border-[#f0c38e]/40 focus:bg-white/[0.06]"
              placeholder={dictionary.calendar.bulkDatePlaceholder}
              value={targetDateInput}
              onChange={(event) =>
                setTargetDateInput(maskDateInput(event.target.value))
              }
            />
          </label>

          {validationMessage ? (
            <p className="text-sm text-rose-200">{validationMessage}</p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center justify-end gap-2">
            <ModalActionButton disabled={isSubmitting} onClick={closeDialog}>
              <X aria-hidden="true" className="size-3.5" />
              {dictionary.actions.cancel}
            </ModalActionButton>
            <ModalActionButton
              disabled={isSubmitting}
              onClick={() => void handleTransfer('move')}
            >
              <MoveRight aria-hidden="true" className="size-3.5" />
              {dictionary.calendar.transferMove}
            </ModalActionButton>
            <ModalActionButton
              tone="accent"
              disabled={isSubmitting}
              onClick={() => void handleTransfer('duplicate')}
            >
              <Copy aria-hidden="true" className="size-3.5" />
              {dictionary.calendar.transferDuplicate}
            </ModalActionButton>
          </div>
        </div>
      </Dialog>
    </>
  );
}
