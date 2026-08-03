'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IconButton, Input, ModalActionButton } from '@/components/ui';
import type { LocalDateString } from '@/lib/domain';
import {
  createLocalDateKey,
  createMonthGrid,
  formatDateInputValue,
  getTodayKey,
  maskDateInput,
  parseDateInputValue,
  parseLocalDateKey,
} from '@/lib/time';
import { useAppContext } from '@/providers';

const popoverWidth = 288;
const viewportPadding = 12;
const popoverGap = 8;

function moveMonth(
  monthDate: LocalDateString,
  monthOffset: number,
): LocalDateString {
  const date = parseLocalDateKey(monthDate);

  return createLocalDateKey(
    date.getFullYear(),
    date.getMonth() + monthOffset,
    1,
  );
}

export function DatePicker({
  autoFocus = false,
  disabled = false,
  label,
  placeholder,
  value,
  onChange,
}: {
  autoFocus?: boolean;
  disabled?: boolean;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { dictionary, locale, timezonePreference } = useAppContext();
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();
  const selectedDate = parseDateInputValue(value);
  const today = getTodayKey(timezonePreference.timezone);
  const [isOpen, setIsOpen] = useState(false);
  const [monthDate, setMonthDate] = useState<LocalDateString>(
    selectedDate ?? today,
  );
  const [popoverPosition, setPopoverPosition] = useState({
    left: viewportPadding,
    top: viewportPadding,
  });
  const monthDays = useMemo(() => createMonthGrid(monthDate), [monthDate]);
  const monthNumber = parseLocalDateKey(monthDate).getMonth();
  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
      }),
    [locale],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'long',
      }),
    [locale],
  );

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
    onChange(formatDateInputValue(date));
    setMonthDate(date);
    setIsOpen(false);
    inputRef.current?.focus();
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
      <div className="flex items-center justify-between gap-2">
        <IconButton
          aria-label={dictionary.calendar.previousMonth}
          size="compact"
          className="rounded-full bg-white/[0.045] text-[#aebac8] hover:bg-white/[0.1] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
          onClick={() => setMonthDate((current) => moveMonth(current, -1))}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </IconButton>
        <span className="text-sm font-semibold capitalize text-[#fff9f2]">
          {monthFormatter.format(parseLocalDateKey(monthDate))}
        </span>
        <IconButton
          aria-label={dictionary.calendar.nextMonth}
          size="compact"
          className="rounded-full bg-white/[0.045] text-[#aebac8] hover:bg-white/[0.1] hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
          onClick={() => setMonthDate((current) => moveMonth(current, 1))}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </IconButton>
      </div>

      <div
        aria-hidden="true"
        className="mt-2 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#7b8da0]"
      >
        {dictionary.calendar.weekdays.map((weekday) => (
          <span key={weekday} className="leading-8">
            {weekday}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {monthDays.map((day) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.date === today;
          const dayDate = parseLocalDateKey(day.date);

          return (
            <button
              key={day.date}
              type="button"
              aria-label={dateFormatter.format(dayDate)}
              aria-pressed={isSelected}
              className={`inline-flex size-8 items-center justify-center rounded-full text-xs font-medium tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] ${
                isSelected
                  ? 'bg-[#f0c38e] text-[#253241] shadow-sm shadow-[#f0c38e]/20'
                  : isToday
                    ? 'bg-[#f0c38e]/12 text-[#f7d7ad] inset-ring-hairline inset-ring-[#f0c38e]/35 hover:bg-[#f0c38e]/20'
                    : 'text-[#cbd5e0] hover:bg-white/[0.08] hover:text-[#fff9f2]'
              } ${dayDate.getMonth() === monthNumber ? '' : 'opacity-35'}`}
              onClick={() => selectDate(day.date)}
            >
              {dayDate.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <ModalActionButton onClick={() => selectDate(today)}>
          <CalendarDays aria-hidden="true" className="size-3.5" />
          {dictionary.calendar.today}
        </ModalActionButton>
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={fieldRef}
      className="grid gap-2 text-sm font-medium text-[#fff9f2]"
    >
      <span>{label}</span>
      <div className="relative">
        <Input
          ref={inputRef}
          aria-label={label}
          inputMode="numeric"
          maxLength={10}
          placeholder={placeholder}
          value={value}
          className="h-11 w-full rounded-xl inset-ring-hairline inset-ring-white/10 bg-white/[0.04] px-3 pr-11 text-sm text-[#fff9f2] outline-none transition placeholder:text-[#7b8da0] hover:inset-ring-white/[0.16] focus:inset-ring-[#f0c38e]/40 focus:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e]"
          disabled={disabled}
          onChange={(event) => {
            const nextValue = maskDateInput(event.target.value);
            const nextDate = parseDateInputValue(nextValue);

            if (nextDate) {
              setMonthDate(nextDate);
            }

            onChange(nextValue);
          }}
        />
        <IconButton
          aria-label={openDatePickerLabel}
          aria-controls={popoverId}
          aria-expanded={isOpen}
          size="compact"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-[#f0c38e]/10 text-[#f7d7ad] hover:bg-[#f0c38e]/18 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
          disabled={disabled}
          onClick={() => {
            setMonthDate(selectedDate ?? today);
            setIsOpen((current) => !current);
          }}
        >
          <CalendarDays aria-hidden="true" className="size-4" />
        </IconButton>
      </div>
      {typeof document === 'undefined' || !calendar
        ? calendar
        : createPortal(calendar, document.body)}
    </div>
  );
}
