'use client';

import { FileUp, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Dialog, ModalActionButton, toast } from '@/components/ui';
import { importCalendarDays } from '@/lib/db';
import type { Dictionary } from '@/lib/i18n';
import { useAppContext } from '@/providers';
import {
  MAX_IMPORT_DAYS,
  MAX_IMPORT_ITEMS,
  parseCalendarImportPayload,
  type CalendarImportError,
} from './calendar-import-parser';

const importErrorMessageKeys = {
  emptyPayload: 'importEmptyPayload',
  invalidCategory: 'importInvalidCategory',
  invalidChildren: 'importInvalidChildren',
  invalidColor: 'importInvalidColor',
  invalidDate: 'importInvalidDate',
  invalidDay: 'importInvalidDay',
  invalidItem: 'importInvalidItem',
  invalidItems: 'importInvalidItems',
  invalidJson: 'importInvalidJson',
  invalidPriority: 'importInvalidPriority',
  invalidRoot: 'importInvalidRoot',
  invalidTime: 'importInvalidTime',
  limitExceeded: 'importLimitExceeded',
  requireText: 'importRequireText',
} as const satisfies Record<
  CalendarImportError['code'],
  keyof Dictionary['calendar']
>;

const maxVisibleErrors = 10;

function formatImportError(
  error: CalendarImportError,
  dictionary: Dictionary,
): string {
  return dictionary.calendar[importErrorMessageKeys[error.code]]
    .replace('{path}', error.path)
    .replace('{detail}', error.detail ?? '')
    .replace('{days}', String(MAX_IMPORT_DAYS))
    .replace('{items}', String(MAX_IMPORT_ITEMS));
}

export function CalendarImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { dictionary, scope, timezonePreference } = useAppContext();
  const [payload, setPayload] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setPayload('');
    setIsSubmitting(false);
    onClose();
  }, [onClose]);

  const importPayload = useCallback(async () => {
    if (!scope) {
      return;
    }

    if (!payload.trim()) {
      toast.error(dictionary.calendar.importRequirePayload);
      return;
    }

    const parseResult = parseCalendarImportPayload(payload);

    if (!parseResult.ok) {
      const messages = parseResult.errors
        .slice(0, maxVisibleErrors)
        .map((error) => formatImportError(error, dictionary));

      toast.error(messages[0], {
        details: messages.slice(1),
        durationMs: 10_000,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await importCalendarDays({
        scope,
        days: parseResult.days,
        timezone: timezonePreference.timezone,
      });

      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [dictionary, handleClose, payload, scope, timezonePreference.timezone]);

  return (
    <Dialog
      closeLabel={dictionary.actions.cancel}
      open={open}
      panelClassName="sm:max-w-2xl"
      title={dictionary.calendar.importDialogTitle}
      onClose={handleClose}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
        <p className="text-sm leading-6 text-[#aebac8]">
          {dictionary.calendar.importDescription}
        </p>

        <label className="flex min-h-0 flex-1 flex-col gap-2 text-sm font-medium text-[#fff9f2]">
          <span>{dictionary.calendar.importPayloadLabel}</span>
          <textarea
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={dictionary.calendar.importPlaceholder}
            value={payload}
            className="min-h-56 flex-1 resize-none rounded-[1rem] border border-white/10 bg-white/[0.055] p-3 font-mono text-xs leading-5 text-[#fff9f2] outline-none transition placeholder:text-[#7b8da0] hover:border-white/[0.16] focus:border-[#f0c38e]/[0.42] focus:bg-white/[0.075] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
            onChange={(event) => setPayload(event.target.value)}
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <ModalActionButton onClick={handleClose}>
            <X aria-hidden="true" className="size-3.5" />
            {dictionary.actions.cancel}
          </ModalActionButton>
          <ModalActionButton
            tone="accent"
            disabled={isSubmitting}
            onClick={() => void importPayload()}
          >
            <FileUp aria-hidden="true" className="size-3.5" />
            {dictionary.calendar.importApply}
          </ModalActionButton>
        </div>
      </div>
    </Dialog>
  );
}
