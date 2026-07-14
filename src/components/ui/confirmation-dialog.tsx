'use client';

import type { ButtonTone } from './button';
import { Dialog } from './dialog';
import { Text } from './text';

export function ConfirmationDialog({
  cancelLabel,
  confirmTone = 'danger',
  confirmLabel,
  description,
  open,
  title,
  onClose,
  onConfirm,
}: {
  cancelLabel: string;
  confirmTone?: ButtonTone;
  confirmLabel: string;
  description: string;
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      closeLabel={cancelLabel}
      open={open}
      panelClassName="border-transparent shadow-[0_30px_80px_rgba(8,6,20,0.5)] after:hidden sm:h-auto sm:max-w-md"
      title={title}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        <div className="modal-panel px-4 py-3">
          <Text leading="relaxed" tone="muted">
            {description}
          </Text>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-[0.75rem] bg-white/[0.06] px-4 text-sm font-semibold text-[#fff9f2] transition hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`inline-flex h-10 items-center justify-center rounded-[0.75rem] px-4 text-sm font-semibold shadow-md transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
              confirmTone === 'danger'
                ? 'bg-rose-500/90 text-rose-50 shadow-rose-500/20 hover:bg-rose-500 focus-visible:outline-rose-200'
                : 'border border-[#f8d7aa]/70 bg-[#f0c38e] text-[#312c51] shadow-[#f0c38e]/18 hover:border-[#ffe0b8] hover:bg-[#f5d09f] focus-visible:outline-[#f0c38e]'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
