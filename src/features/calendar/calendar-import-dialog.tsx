'use client';

import { useCallback, useState } from 'react';
import { Button, Dialog } from '@/components/ui';
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
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setPayload('');
    setErrorMessages([]);
    setIsSubmitting(false);
    onClose();
  }, [onClose]);

  const importPayload = useCallback(async () => {
    if (!scope) {
      return;
    }

    if (!payload.trim()) {
      setErrorMessages([dictionary.calendar.importRequirePayload]);
      return;
    }

    const parseResult = parseCalendarImportPayload(payload);

    if (!parseResult.ok) {
      setErrorMessages(
        parseResult.errors
          .slice(0, maxVisibleErrors)
          .map((error) => formatImportError(error, dictionary)),
      );
      return;
    }

    setErrorMessages([]);
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
        <p className="text-sm leading-6 text-[#bdb4d4]">
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
            className="min-h-56 flex-1 resize-none rounded-[1rem] border border-white/10 bg-white/[0.055] p-3 font-mono text-xs leading-5 text-[#fff9f2] outline-none transition placeholder:text-[#8f85aa] hover:border-white/[0.16] focus:border-[#f0c38e]/[0.42] focus:bg-white/[0.075] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
            onChange={(event) => setPayload(event.target.value)}
          />
        </label>

        {errorMessages.length > 0 ? (
          <ul className="grid gap-1 rounded-[1rem] border border-rose-300/[0.18] bg-rose-400/[0.12] px-3 py-2 text-sm font-medium text-rose-100 shadow-sm">
            {errorMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            className="h-12 rounded-[1.15rem] border border-white/10 bg-white/5 px-5 text-[#fff9f2] hover:bg-white/[0.09] focus-visible:outline-[#f0c38e]"
            tone="subtle"
            onClick={handleClose}
          >
            {dictionary.actions.cancel}
          </Button>
          <Button
            className="h-12 rounded-[1.15rem] border border-[#f8d7aa]/70 bg-[#f0c38e] px-5 text-[#312c51] shadow-[0_16px_32px_rgba(240,195,142,0.18)] hover:border-[#ffe0b8] hover:bg-[#f5d09f] focus-visible:outline-[#f0c38e]"
            tone="accent"
            disabled={isSubmitting}
            onClick={() => void importPayload()}
          >
            {dictionary.calendar.importApply}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
