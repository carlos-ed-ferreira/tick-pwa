'use client';

import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { CalendarMonthPanel } from '@/components/app';
import { Dialog, ModalActionButton } from '@/components/ui';
import type { LocalDateString } from '@/lib/domain';
import { useAppContext } from '@/providers';

export function RecurringDateDialog({
  date,
  today,
  onClose,
  onConfirm,
}: {
  date: LocalDateString;
  today: LocalDateString;
  onClose: () => void;
  onConfirm: (date: LocalDateString) => void;
}) {
  const { dictionary } = useAppContext();
  const [draftDate, setDraftDate] = useState(date);
  const [monthDate, setMonthDate] = useState(date);

  return (
    <Dialog
      closeLabel={dictionary.actions.cancel}
      open
      size="sheet"
      title={dictionary.calendar.selectDate}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <CalendarMonthPanel
          monthDate={monthDate}
          selectedDate={draftDate}
          today={today}
          touchCells
          onMonthChange={setMonthDate}
          onSelectDate={setDraftDate}
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <ModalActionButton onClick={onClose}>
            <X aria-hidden="true" className="size-3.5" />
            {dictionary.actions.cancel}
          </ModalActionButton>
          <ModalActionButton tone="accent" onClick={() => onConfirm(draftDate)}>
            <Check aria-hidden="true" className="size-3.5" />
            {dictionary.recurring.confirmDate}
          </ModalActionButton>
        </div>
      </div>
    </Dialog>
  );
}
