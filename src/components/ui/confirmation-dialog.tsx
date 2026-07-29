'use client';

import { Check, Trash2, X } from 'lucide-react';
import type { ButtonTone } from './button';
import { Dialog } from './dialog';
import { ModalActionButton } from './modal-action-button';
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
      panelClassName="sm:h-auto sm:max-w-md"
      title={title}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <Text className="px-1" leading="relaxed" tone="muted">
          {description}
        </Text>
        <div className="mt-4 flex items-center justify-end gap-2">
          <ModalActionButton onClick={onClose}>
            <X aria-hidden="true" className="size-3.5" />
            {cancelLabel}
          </ModalActionButton>
          <ModalActionButton
            tone={confirmTone === 'danger' ? 'danger' : 'accent'}
            onClick={onConfirm}
          >
            {confirmTone === 'danger' ? (
              <Trash2 aria-hidden="true" className="size-3.5" />
            ) : (
              <Check aria-hidden="true" className="size-3.5" />
            )}
            {confirmLabel}
          </ModalActionButton>
        </div>
      </div>
    </Dialog>
  );
}
