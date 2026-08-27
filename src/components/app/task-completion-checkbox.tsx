'use client';

import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Checkbox, CheckboxIndicator } from '@/components/ui';
import { useAnchoredMenu } from '@/hooks/use-anchored-menu';
import {
  getTaskCompletionDisplayLevel,
  getTaskCompletionOptions,
  getTaskCompletionState,
  normalizeTaskCompletionValues,
  type TaskCompletionInput,
  type TaskCompletionSettings,
  type TaskCompletionValues,
} from '@/lib/domain';
import { formatCompletionLevelLabel } from '@/lib/i18n';

const longPressDelay = 450;
const longPressMoveTolerance = 8;
const menuPreferredWidth = 224;
const menuOptionHeight = 40;

interface TaskCompletionLabels {
  chooseCompletionState: string;
  completionStateCompleted: string;
  completionStateIgnored: string;
  completionStateLevel: string;
  completionStateUnchecked: string;
  toggleItem: string;
}

function getTaskCompletionOptionLabel({
  labels,
  levels,
  values,
}: {
  labels: TaskCompletionLabels;
  levels: number;
  values: TaskCompletionValues;
}): string {
  if (values.ignored) {
    return labels.completionStateIgnored;
  }

  if (values.markLevel === 0) {
    return labels.completionStateUnchecked;
  }

  return levels > 1
    ? formatCompletionLevelLabel({
        label: labels.completionStateLevel,
        level: values.markLevel,
        levels,
      })
    : labels.completionStateCompleted;
}

export function TaskCompletionCheckbox({
  completionSettings,
  disabled = false,
  labels,
  values,
  onSelect,
  onToggle,
}: {
  completionSettings: TaskCompletionSettings;
  disabled?: boolean;
  labels: TaskCompletionLabels;
  values: TaskCompletionInput;
  onSelect?: (nextValues: TaskCompletionValues) => Promise<void> | void;
  onToggle: () => Promise<void> | void;
}) {
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const skipNextToggleRef = useRef(false);
  const options = getTaskCompletionOptions(completionSettings);
  const hasPicker = options.length > 2 && Boolean(onSelect) && !disabled;
  const estimateMenuHeight = useCallback(
    () => 16 + options.length * menuOptionHeight,
    [options.length],
  );
  const {
    closeMenu,
    containerRef,
    isOpen,
    menuRef,
    menuStyle,
    openMenu,
    triggerRef,
  } = useAnchoredMenu<HTMLInputElement>({
    estimateMenuHeight,
    preferredWidth: menuPreferredWidth,
  });
  const currentValues = normalizeTaskCompletionValues(values);
  const state = getTaskCompletionState(currentValues);
  const displayLevel = getTaskCompletionDisplayLevel(
    currentValues,
    completionSettings,
  );
  const stateLabel = getTaskCompletionOptionLabel({
    labels,
    levels: completionSettings.levels,
    values: currentValues,
  });

  const cancelLongPress = useCallback(() => {
    if (longPressTimeoutRef.current !== null) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    longPressOriginRef.current = null;
  }, []);

  function startLongPress(event: ReactPointerEvent<HTMLInputElement>) {
    skipNextToggleRef.current = false;

    if (!hasPicker || event.pointerType === 'mouse') {
      return;
    }

    longPressOriginRef.current = { x: event.clientX, y: event.clientY };
    longPressTimeoutRef.current = setTimeout(() => {
      skipNextToggleRef.current = true;
      openMenu();
    }, longPressDelay);
  }

  function trackLongPress(event: ReactPointerEvent<HTMLInputElement>) {
    const origin = longPressOriginRef.current;

    if (!origin) {
      return;
    }

    const hasMovedAway =
      Math.abs(event.clientX - origin.x) > longPressMoveTolerance ||
      Math.abs(event.clientY - origin.y) > longPressMoveTolerance;

    if (hasMovedAway) {
      cancelLongPress();
    }
  }

  async function selectOption(nextValues: TaskCompletionValues) {
    closeMenu();
    await onSelect?.(nextValues);
  }

  const menu =
    isOpen && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            aria-label={labels.chooseCompletionState}
            role="menu"
            className="modal-panel modal-panel--flat fixed z-60 grid gap-1 p-2 text-sm text-[#fff9f2] shadow-[0_24px_70px_rgba(5,8,13,0.44)]"
            style={menuStyle}
          >
            {options.map((option) => {
              const optionLabel = getTaskCompletionOptionLabel({
                labels,
                levels: completionSettings.levels,
                values: option,
              });
              const isCurrent =
                option.ignored === currentValues.ignored &&
                option.markLevel === displayLevel;

              return (
                <button
                  key={optionLabel}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  className={`flex min-h-9 items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-[#f0c38e]/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] ${
                    isCurrent ? 'bg-[#f0c38e]/10' : ''
                  }`}
                  onClick={() => void selectOption(option)}
                >
                  <CheckboxIndicator
                    checked={option.completed}
                    indeterminate={option.ignored}
                    level={option.markLevel}
                    levels={completionSettings.levels}
                  />
                  <span className="truncate">{optionLabel}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className="flex shrink-0 items-center">
      <Checkbox
        ref={triggerRef}
        aria-label={
          completionSettings.levels > 1
            ? `${labels.toggleItem}: ${stateLabel}`
            : labels.toggleItem
        }
        checked={state === 'completed'}
        indeterminate={state === 'ignored'}
        level={displayLevel}
        levels={completionSettings.levels}
        disabled={disabled}
        onChange={() => {
          if (skipNextToggleRef.current) {
            skipNextToggleRef.current = false;
            return;
          }

          void onToggle();
        }}
        onContextMenu={(event) => {
          if (!hasPicker) {
            return;
          }

          event.preventDefault();
          cancelLongPress();
          openMenu();
        }}
        onPointerCancel={cancelLongPress}
        onPointerDown={startLongPress}
        onPointerLeave={cancelLongPress}
        onPointerMove={trackLongPress}
        onPointerUp={cancelLongPress}
      />
      {menu}
    </div>
  );
}
