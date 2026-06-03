'use client';

import { Button } from './button';
import { Dialog } from './dialog';
import { Text } from './text';

export function ConfirmationDialog({
  cancelLabel,
  confirmLabel,
  description,
  open,
  title,
  onClose,
  onConfirm,
}: {
  cancelLabel: string;
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
      panelClassName="sm:h-auto sm:max-w-md"
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
          <Button
            className="h-12 rounded-[1.15rem] border border-white/10 bg-white/5 px-5 text-[#fff9f2] hover:bg-white/[0.09] focus-visible:outline-[#f0c38e]"
            tone="subtle"
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            className="h-12 rounded-[1.15rem] border border-rose-300/24 bg-rose-400/15 px-5 text-rose-50 shadow-[0_14px_28px_rgba(244,63,94,0.14)] hover:bg-rose-400/22 focus-visible:outline-rose-200"
            tone="danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
