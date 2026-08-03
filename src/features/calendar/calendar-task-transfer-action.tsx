'use client';

import { ArrowRightLeft, Copy, MoveRight, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { DatePicker } from '@/components/app';
import { Button, Dialog, ModalActionButton, toast } from '@/components/ui';
import type { LocalDateString } from '@/lib/domain';
import { formatLocalDateLabel } from '@/lib/i18n';
import { parseLocalDateKey } from '@/lib/time';
import { parseDateInputValue } from '@/lib/time';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sourceDateLabel = useMemo(
    () =>
      formatLocalDateLabel(
        createDateLabelDate(sourceDate),
        locale,
        timezonePreference.timezone,
      ),
    [locale, sourceDate, timezonePreference.timezone],
  );

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setTargetDateInput('');
    setIsSubmitting(false);
  }, []);

  async function handleTransfer(transfer: 'move' | 'duplicate'): Promise<void> {
    const targetDate = parseDateInputValue(targetDateInput);

    if (!targetDate) {
      toast.error(dictionary.calendar.transferInvalidDate);
      return;
    }

    if (targetDate === sourceDate) {
      toast.error(dictionary.calendar.transferSameDate);
      return;
    }

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
        className="rounded-full inset-ring-white/10 bg-white/5 px-4 text-[#fff9f2] hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
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
          <p className="text-sm leading-6 text-[#aebac8]">
            {dictionary.calendar.transferDescription}
          </p>

          <div className="grid gap-1 rounded-xl bg-white/[0.035] px-3 py-2.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#909cab]">
              {dictionary.calendar.title}
            </span>
            <span className="font-medium text-[#fff9f2]">
              {sourceDateLabel}
            </span>
          </div>

          <DatePicker
            autoFocus
            label={dictionary.calendar.transferTargetDate}
            placeholder={dictionary.calendar.bulkDatePlaceholder}
            value={targetDateInput}
            onChange={setTargetDateInput}
          />

          <div className="mt-auto flex flex-wrap items-center justify-end gap-2">
            <ModalActionButton disabled={isSubmitting} onClick={closeDialog}>
              <X aria-hidden="true" className="size-3.5" />
              {dictionary.actions.cancel}
            </ModalActionButton>
            <ModalActionButton
              tone="secondary"
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
