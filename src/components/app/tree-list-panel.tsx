'use client';

import { Plus, X } from 'lucide-react';
import { useState, type DragEvent, type ReactNode } from 'react';
import { ConfirmationDialog, DashedRing } from '@/components/ui';
import { useFocusAfterCreate } from '@/hooks/use-focus-after-create';

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
  selectionActions,
  surface = 'panel',
  toolbarActions,
}: {
  addLabel: string;
  bulkDeleteDialog?: BulkDeleteDialog;
  children: ReactNode;
  clearSelectionLabel: string;
  emptyLabel: string;
  hasRows: boolean;
  isSelectionMode: boolean;
  onAddRoot: () => Promise<string | null> | string | null;
  onClearSelection: () => void;
  selectionActions?: ReactNode;
  surface?: 'panel' | 'none';
  toolbarActions?: ReactNode;
}) {
  const focusAfterCreate = useFocusAfterCreate();
  const [isMovingItem, setIsMovingItem] = useState(false);

  async function handleAddRoot() {
    const itemId = await onAddRoot();

    if (itemId) {
      focusAfterCreate(itemId);
    }
  }

  function isMovingToTop(event: DragEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) {
      return false;
    }

    const row = event.target.closest<HTMLElement>('[data-tree-row]');
    const firstRow =
      event.currentTarget.querySelector<HTMLElement>('[data-tree-row]');

    if (!row || row !== firstRow) {
      return false;
    }

    const rect = row.getBoundingClientRect();
    return rect.height > 0 && event.clientY - rect.top < rect.height * 0.25;
  }

  return (
    <>
      <div
        data-testid="tree-list-panel"
        className={
          surface === 'panel'
            ? `modal-panel min-h-0 flex-1 overflow-y-auto px-2 pb-2 transition-[padding] ${
                isMovingItem ? 'pt-3' : 'pt-2'
              }`
            : `min-h-0 flex-1 overflow-y-auto transition-[padding] ${
                isMovingItem ? 'pt-1' : ''
              }`
        }
        onDragEnd={() => setIsMovingItem(false)}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setIsMovingItem(false);
          }
        }}
        onDragOver={(event) => setIsMovingItem(isMovingToTop(event))}
        onDrop={() => setIsMovingItem(false)}
      >
        {hasRows ? (
          <div className="grid gap-1">{children}</div>
        ) : (
          <button
            type="button"
            className="relative flex min-h-36 w-full items-center justify-center rounded-[1.15rem] bg-[#f0c38e]/[0.045] px-4 text-sm font-medium text-[#aebac8] shadow-inner transition [--dashed-ring-color:rgba(240,195,142,0.24)] hover:bg-[#f0c38e]/[0.075] hover:text-[#fff9f2] hover:[--dashed-ring-color:rgba(240,195,142,0.38)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
            onClick={() => void handleAddRoot()}
          >
            <DashedRing radius={18.4} />
            {emptyLabel}
          </button>
        )}

        {hasRows ? (
          <div
            data-tree-list-toolbar="true"
            className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2"
          >
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full inset-ring-hairline inset-ring-[#f0c38e]/22 bg-[#f0c38e]/10 px-3 py-1.5 text-sm font-medium text-[#f7d7ad] shadow-sm transition hover:inset-ring-[#f0c38e]/36 hover:bg-[#f0c38e]/16 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
                onClick={() => void handleAddRoot()}
              >
                <Plus aria-hidden="true" className="size-3.5" />
                {addLabel}
              </button>
              {toolbarActions}
            </div>
            {isSelectionMode ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
                {selectionActions}
                <button
                  type="button"
                  className="flex min-h-8 items-center gap-1.5 rounded-full inset-ring-hairline inset-ring-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-[#aebac8] shadow-sm transition hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
                  onClick={onClearSelection}
                >
                  <X aria-hidden="true" className="size-3.5" />
                  {clearSelectionLabel}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {bulkDeleteDialog ? (
        <ConfirmationDialog
          cancelLabel={bulkDeleteDialog.cancelLabel}
          confirmLabel={bulkDeleteDialog.confirmLabel}
          description={bulkDeleteDialog.description}
          open={bulkDeleteDialog.open}
          title={bulkDeleteDialog.title}
          onClose={bulkDeleteDialog.onClose}
          onConfirm={bulkDeleteDialog.onConfirm}
        />
      ) : null}
    </>
  );
}
