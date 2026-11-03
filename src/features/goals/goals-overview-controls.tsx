'use client';

import { Plus, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { DashedRing, Dialog, Input, ModalActionButton } from '@/components/ui';
import { PositionSide } from './goal-drag-target';

export function CreateGoalGroupDialog({
  cancelLabel,
  confirmLabel,
  groupTitleLabel,
  initialTitle,
  isCreatingGroup,
  title,
  onClose,
  onConfirm,
}: {
  cancelLabel: string;
  confirmLabel: string;
  groupTitleLabel: string;
  initialTitle: string;
  isCreatingGroup: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (title: string) => void;
}) {
  const [groupTitle, setGroupTitle] = useState(initialTitle.toUpperCase());

  const closeDialog = useCallback(() => {
    if (!isCreatingGroup) {
      onClose();
    }
  }, [isCreatingGroup, onClose]);

  const normalizedTitle = groupTitle.trim();

  return (
    <Dialog
      closeLabel={cancelLabel}
      open
      panelClassName="sm:h-auto sm:max-w-md"
      title={title}
      onClose={closeDialog}
    >
      <form
        className="flex flex-col gap-5 p-4 sm:p-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();

          if (normalizedTitle.length > 0) {
            onConfirm(normalizedTitle);
          }
        }}
      >
        <label
          className={`grid gap-2 text-sm font-medium text-[#fff9f2] ${
            isCreatingGroup ? 'opacity-75' : ''
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#909cab]">
            {groupTitleLabel}
          </span>
          <Input
            aria-label={groupTitleLabel}
            className="h-10 w-full rounded-xl inset-ring-hairline inset-ring-white/10 bg-white/[0.04] px-3 text-base font-medium text-[#fff9f2] outline-none placeholder:text-[#7b8da0] focus:inset-ring-[#f0c38e]/40 focus:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-muted/60"
            disabled={isCreatingGroup}
            placeholder={initialTitle}
            value={groupTitle}
            onChange={(event) =>
              setGroupTitle(event.target.value.toUpperCase())
            }
          />
        </label>
        <div className="flex items-center justify-end gap-2">
          <ModalActionButton onClick={closeDialog}>
            <X aria-hidden="true" className="size-3.5" />
            {cancelLabel}
          </ModalActionButton>
          <ModalActionButton
            type="submit"
            tone="accent"
            disabled={normalizedTitle.length === 0 || isCreatingGroup}
          >
            <Plus aria-hidden="true" className="size-3.5" />
            {confirmLabel}
          </ModalActionButton>
        </div>
      </form>
    </Dialog>
  );
}

export function NewEntityCard({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group relative flex h-32 flex-col items-center justify-center gap-3 rounded-[1.35rem] bg-transparent p-4 text-center text-[#cbd5e0] transition [--dashed-ring-color:rgba(144,156,171,0.3)] hover:-translate-y-0.5 hover:bg-white/[0.02] hover:[--dashed-ring-color:rgba(240,195,142,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d9b0]"
      onClick={onClick}
    >
      <DashedRing radius={21.6} />
      <div className="flex size-11 items-center justify-center rounded-full bg-[#f0c38e]/10 text-[#f0c38e] transition transform group-hover:bg-[#f0c38e]/20 group-hover:scale-105">
        <Plus aria-hidden="true" className="size-5" />
      </div>
      <span className="text-sm font-semibold text-[#f8dfbd] transition group-hover:text-[#f0c38e]">
        {label}
      </span>
    </button>
  );
}

export function DropTargetOverlay() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] bg-[#f0c38e]/10 shadow-[0_18px_34px_rgba(5,8,13,0.12)] [--dashed-ring-color:rgba(240,195,142,0.8)]"
    >
      <DashedRing radius={21.6} />
    </span>
  );
}

export function PositionIndicator({ side }: { side: PositionSide }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute top-4 z-20 h-[calc(100%-2rem)] w-1 rounded-full bg-[#f0c38e] shadow-[0_0_0_3px_rgba(240,195,142,0.16),0_0_18px_rgba(240,195,142,0.42)] ${
        side === 'before' ? '-left-2' : '-right-2'
      }`}
    />
  );
}
