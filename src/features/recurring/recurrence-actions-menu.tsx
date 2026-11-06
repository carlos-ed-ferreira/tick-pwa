'use client';

import { MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  BottomSheet,
  BottomSheetAction,
  ConfirmationDialog,
  IconButton,
  toast,
} from '@/components/ui';
import {
  goalMenuDangerItemClassName,
  goalMenuItemClassName,
} from '@/features/goals/goal-card-styles';
import { useAnchoredMenu } from '@/hooks/use-anchored-menu';
import { useTouchComposition } from '@/hooks/use-touch-composition';
import {
  pauseRecurrence,
  resumeRecurrence,
  softDeleteRecurrence,
} from '@/lib/db';
import {
  isRecurrencePaused,
  type LocalDateString,
  type Recurrence,
} from '@/lib/domain';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { useAppContext } from '@/providers';

const menuPreferredWidth = 220;
const menuItemHeight = 40;

interface RecurrenceAction {
  danger: boolean;
  icon: ReactNode;
  key: string;
  label: string;
  run: () => void;
}

function getDeleteDescription(
  labels: Dictionary['recurring'],
  count: number,
): string {
  if (count === 0) {
    return labels.deleteDescriptionNone;
  }

  return count === 1
    ? labels.deleteDescriptionOne
    : labels.deleteDescriptionMany.replace('{count}', String(count));
}

function runCommand(action: () => Promise<void>, failureMessage: string) {
  void action().catch((error: unknown) => {
    console.error('Failed to change a recurrence.', error);
    toast.error(failureMessage);
  });
}

function moveMenuFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return;
  }

  const items = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]',
    ),
  ];
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  const step = event.key === 'ArrowDown' ? 1 : -1;

  event.preventDefault();
  items[(current + step + items.length) % items.length]?.focus();
}

function AnchoredActionsMenu({
  actions,
  label,
}: {
  actions: RecurrenceAction[];
  label: string;
}) {
  const estimateMenuHeight = useCallback(
    () => 16 + actions.length * menuItemHeight,
    [actions.length],
  );
  const {
    closeMenu,
    containerRef,
    isOpen,
    menuRef,
    menuStyle,
    openMenu,
    triggerRef,
  } = useAnchoredMenu<HTMLButtonElement>({
    estimateMenuHeight,
    preferredWidth: menuPreferredWidth,
  });

  useEffect(() => {
    if (isOpen) {
      menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }, [isOpen, menuRef]);

  return (
    <div ref={containerRef} className="inline-flex">
      <IconButton
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={label}
        size="compact"
        className="rounded-full text-[#aebac8] hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
        onClick={() => (isOpen ? closeMenu() : openMenu())}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </IconButton>
      {isOpen && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={label}
              className="modal-panel modal-panel--flat fixed z-60 grid gap-1 p-2 text-sm text-[#fff9f2] shadow-[0_24px_70px_rgba(5,8,13,0.44)]"
              style={menuStyle}
              onKeyDown={moveMenuFocus}
            >
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  className={
                    action.danger
                      ? goalMenuDangerItemClassName
                      : goalMenuItemClassName
                  }
                  onClick={() => {
                    closeMenu({ restoreFocus: true });
                    action.run();
                  }}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function SheetActionsMenu({
  actions,
  closeLabel,
  label,
  title,
}: {
  actions: RecurrenceAction[];
  closeLabel: string;
  label: string;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <IconButton
        aria-label={label}
        size="compact"
        className="rounded-full text-[#aebac8] hover:bg-white/[0.08] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
        onClick={() => setIsOpen(true)}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </IconButton>
      <BottomSheet
        closeLabel={closeLabel}
        open={isOpen}
        title={title}
        onClose={() => setIsOpen(false)}
      >
        <div className="flex flex-col gap-1">
          {actions.map((action) => (
            <BottomSheetAction
              key={action.key}
              icon={action.icon}
              tone={action.danger ? 'danger' : 'neutral'}
              onSelect={() => {
                setIsOpen(false);
                action.run();
              }}
            >
              {action.label}
            </BottomSheetAction>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

function useRecurrenceActions({
  recurrence,
  today,
  onDelete,
  onEdit,
}: {
  recurrence: Recurrence;
  today: LocalDateString;
  onDelete: () => void;
  onEdit: (recurrence: Recurrence) => void;
}): RecurrenceAction[] {
  const { dictionary, scope } = useAppContext();
  const labels = dictionary.recurring;
  const isPaused = isRecurrencePaused(recurrence.schedule);
  const PauseIcon = isPaused ? Play : Pause;

  function togglePause() {
    if (scope) {
      const command = isPaused ? resumeRecurrence : pauseRecurrence;

      runCommand(
        () => command({ recurrenceId: recurrence.id, scope, today }),
        labels.saveFailed,
      );
    }
  }

  return [
    {
      danger: false,
      icon: <Pencil aria-hidden="true" className="size-4" />,
      key: 'edit',
      label: labels.actionEdit,
      run: () => onEdit(recurrence),
    },
    {
      danger: false,
      icon: <PauseIcon aria-hidden="true" className="size-4" />,
      key: 'pause',
      label: isPaused ? labels.actionResume : labels.actionPause,
      run: togglePause,
    },
    {
      danger: true,
      icon: <Trash2 aria-hidden="true" className="size-4" />,
      key: 'delete',
      label: labels.actionDelete,
      run: onDelete,
    },
  ];
}

export function RecurrenceActionsMenu({
  answerCount,
  recurrence,
  today,
  onEdit,
}: {
  answerCount: number;
  recurrence: Recurrence;
  today: LocalDateString;
  onEdit: (recurrence: Recurrence) => void;
}) {
  const { dictionary, scope } = useAppContext();
  const labels = dictionary.recurring;
  const isTouchComposition = useTouchComposition();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const menuLabel = labels.moreActions.replace('{name}', recurrence.text);
  const actions = useRecurrenceActions({
    recurrence,
    today,
    onDelete: () => setIsDeleteOpen(true),
    onEdit,
  });

  function confirmDelete() {
    setIsDeleteOpen(false);

    if (scope) {
      runCommand(
        () => softDeleteRecurrence({ recurrenceId: recurrence.id, scope }),
        labels.saveFailed,
      );
    }
  }

  return (
    <>
      {isTouchComposition ? (
        <SheetActionsMenu
          actions={actions}
          closeLabel={dictionary.actions.cancel}
          label={menuLabel}
          title={recurrence.text}
        />
      ) : (
        <AnchoredActionsMenu actions={actions} label={menuLabel} />
      )}
      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmLabel={dictionary.actions.delete}
        description={getDeleteDescription(labels, answerCount)}
        open={isDeleteOpen}
        title={labels.deleteTitle}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
