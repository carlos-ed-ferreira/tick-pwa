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
      <div className="card-surface-soft min-h-0 flex-1 overflow-y-auto p-2">
        {hasRows ? (
          <div className="grid gap-1">{children}</div>
        ) : (
          <button
            type="button"
            className="flex min-h-32 w-full items-center justify-center rounded-2xl bg-background/55 px-4 text-sm text-muted shadow-inner transition hover:bg-background/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            onClick={() => void onAddRoot()}
          >
            {emptyLabel}
          </button>
        )}

        {hasRows ? (
          <div className="flex items-center justify-between px-1 pt-1">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full bg-background/55 px-2.5 py-1.5 text-sm text-muted shadow-sm transition hover:bg-accent/25 hover:text-foreground"
              onClick={() => void onAddRoot()}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              {addLabel}
            </button>
            {isSelectionMode ? (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-background/55 px-2.5 py-1.5 text-sm text-muted shadow-sm transition hover:bg-accent/25 hover:text-foreground"
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
