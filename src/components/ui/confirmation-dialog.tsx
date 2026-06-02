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
        <Text leading="relaxed" tone="muted">
          {description}
        </Text>
        <div className="flex items-center justify-end gap-2">
          <Button className="min-h-11 px-4" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            className="min-h-11 bg-rose-600 px-4 text-white shadow-[0_14px_28px_rgba(225,29,72,0.22)] hover:bg-rose-500"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
