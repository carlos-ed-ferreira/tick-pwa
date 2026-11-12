'use client';

import { CalendarDays, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { FormField, IconButton, ModalActionButton } from '@/components/ui';
import type { LocalDateString } from '@/lib/domain';
import {
  formatDateInputValue,
  getTodayKey,
  maskDateInput,
  parseDateInputValue,
} from '@/lib/time';
import { useAppContext } from '@/providers';
import { CalendarMonthPanel } from './calendar-month-panel';

const popoverWidth = 288;
const viewportPadding = 12;
const popoverGap = 8;

export function DatePicker({
  autoFocus = false,
  disabled = false,
  label,
  placeholder,
  value,
  variant = 'field',
  renderTrigger,
  onChange,
  onClear,
}: {
  autoFocus?: boolean;
  disabled?: boolean;
  label: string;
  placeholder?: string;
  value: string;
  variant?: 'field' | 'trigger';
  renderTrigger?: (args: {
    isOpen: boolean;
    onClick: () => void;
    ariaLabel: string;
  }) => ReactNode;
  onChange: (value: string) => void;
  onClear?: () => void;
}) {
  const { dictionary, locale, timezonePreference } = useAppContext();
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();
  const selectedDate = parseDateInputValue(value, locale);
  const today = getTodayKey(timezonePreference.timezone);
  const [isOpen, setIsOpen] = useState(false);
  const [monthDate, setMonthDate] = useState<LocalDateString>(
    selectedDate ?? today,
  );
  const [popoverPosition, setPopoverPosition] = useState({
    left: viewportPadding,
    top: viewportPadding,
  });

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    let focusFrameId = 0;
    const frameId = window.requestAnimationFrame(() => {
      focusFrameId = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(focusFrameId);
    };
  }, [autoFocus]);

  const updatePopoverPosition = useCallback(() => {
    const field = fieldRef.current;

    if (!field) {
      return;
    }

    const fieldRect = field.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.offsetHeight ?? 390;
    const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
    const effectiveWidth = Math.min(popoverWidth, availableWidth);
    const left = Math.min(
      Math.max(viewportPadding, fieldRect.right - effectiveWidth),
      Math.max(
        viewportPadding,
        window.innerWidth - effectiveWidth - viewportPadding,
      ),
    );
    const belowTop = fieldRect.bottom + popoverGap;
    const aboveTop = fieldRect.top - popoverHeight - popoverGap;
    const top =
      belowTop + popoverHeight <= window.innerHeight - viewportPadding ||
      aboveTop < viewportPadding
        ? belowTop
        : aboveTop;

    setPopoverPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);

    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [isOpen, updatePopoverPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        !fieldRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setIsOpen(false);
        inputRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  function selectDate(date: LocalDateString) {
    onChange(formatDateInputValue(date, locale));
    setMonthDate(date);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function clearDate() {
    onClear?.();
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function toggleOpen() {
    setMonthDate(selectedDate ?? today);
    setIsOpen((current) => !current);
  }

  const openDatePickerLabel = dictionary.calendar.openDatePicker.replace(
    '{label}',
    label,
  );
  const calendar = isOpen ? (
    <div
      ref={popoverRef}
      id={popoverId}
      role="dialog"
      aria-label={dictionary.calendar.selectDate}
      className="tick-datepicker fixed z-[90] w-72 rounded-2xl bg-[#16202c]/98 p-3 text-[#fff9f2] shadow-[0_24px_70px_rgba(5,8,13,0.56)] backdrop-blur-xl"
      style={popoverPosition}
    >
      <CalendarMonthPanel
        monthDate={monthDate}
        selectedDate={selectedDate}
        today={today}
        onMonthChange={setMonthDate}
        onSelectDate={selectDate}
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        {onClear && value ? (
          <ModalActionButton onClick={clearDate}>
            <X aria-hidden="true" className="size-3.5" />
            {dictionary.calendar.clearDate}
          </ModalActionButton>
        ) : (
          <span />
        )}
        <ModalActionButton onClick={() => selectDate(today)}>
          <CalendarDays aria-hidden="true" className="size-3.5" />
          {dictionary.calendar.today}
        </ModalActionButton>
      </div>
    </div>
  ) : null;

  if (variant === 'trigger') {
    return (
      <div ref={fieldRef} className="relative inline-flex">
        {renderTrigger?.({
          isOpen,
          onClick: toggleOpen,
          ariaLabel: openDatePickerLabel,
        })}
        {typeof document === 'undefined' || !calendar
          ? calendar
          : createPortal(calendar, document.body)}
      </div>
    );
  }

  return (
    <div ref={fieldRef}>
      <FormField
        ref={inputRef}
        disabled={disabled}
        inputMode="numeric"
        label={label}
        maxLength={10}
        placeholder={placeholder}
        value={value}
        endAdornment={
          <IconButton
            aria-label={openDatePickerLabel}
            aria-controls={popoverId}
            aria-expanded={isOpen}
            size="compact"
            className="rounded-full bg-[#f0c38e]/14 text-[#f7d7ad] hover:bg-[#f0c38e]/22 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
            disabled={disabled}
            onClick={toggleOpen}
          >
            <CalendarDays aria-hidden="true" className="size-4" />
          </IconButton>
        }
        onChange={(event) => {
          const nextValue = maskDateInput(event.target.value, locale);
          const nextDate = parseDateInputValue(nextValue, locale);

          if (nextDate) {
            setMonthDate(nextDate);
          }

          onChange(nextValue);
        }}
      />
      {typeof document === 'undefined' || !calendar
        ? calendar
        : createPortal(calendar, document.body)}
    </div>
  );
}
