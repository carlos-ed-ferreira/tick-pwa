'use client';

import { Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConfirmationDialog } from '@/components/ui';

interface BulkDeleteDialog {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function TreeListPanel({
  addLabel,
  bulkDeleteDialog,
  children,
  clearSelectionLabel,
  emptyLabel,
  hasRows,
  isSelectionMode,
  onAddRoot,
  onClearSelection,
}: {
  addLabel: string;
  bulkDeleteDialog: BulkDeleteDialog;
  children: ReactNode;
  clearSelectionLabel: string;
  emptyLabel: string;
  hasRows: boolean;
  isSelectionMode: boolean;
  onAddRoot: () => Promise<void> | void;
  onClearSelection: () => void;
}) {
  return (
    <>
      <div className="modal-panel min-h-0 flex-1 overflow-y-auto p-2">
        {hasRows ? (
          <div className="grid gap-1">{children}</div>
        ) : (
          <button
            type="button"
            className="flex min-h-36 w-full items-center justify-center rounded-[1.15rem] border border-dashed border-[#f0c38e]/24 bg-[#f0c38e]/[0.045] px-4 text-sm font-medium text-[#bdb4d4] shadow-inner transition hover:border-[#f0c38e]/38 hover:bg-[#f0c38e]/[0.075] hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
            onClick={() => void onAddRoot()}
          >
            {emptyLabel}
          </button>
        )}

        {hasRows ? (
          <div className="flex items-center justify-between px-1 pt-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-[#f0c38e]/22 bg-[#f0c38e]/10 px-3 py-1.5 text-sm font-medium text-[#f7d7ad] shadow-sm transition hover:border-[#f0c38e]/36 hover:bg-[#f0c38e]/16 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
              onClick={() => void onAddRoot()}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              {addLabel}
            </button>
            {isSelectionMode ? (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-[#bdb4d4] shadow-sm transition hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
                onClick={onClearSelection}
              >
                <X aria-hidden="true" className="size-3.5" />
                {clearSelectionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConfirmationDialog
        cancelLabel={bulkDeleteDialog.cancelLabel}
        confirmLabel={bulkDeleteDialog.confirmLabel}
        description={bulkDeleteDialog.description}
        open={bulkDeleteDialog.open}
        title={bulkDeleteDialog.title}
        onClose={bulkDeleteDialog.onClose}
        onConfirm={bulkDeleteDialog.onConfirm}
      />
    </>
  );
}
