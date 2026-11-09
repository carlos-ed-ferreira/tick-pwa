'use client';

import type { ReactNode } from 'react';
import { DatePicker } from '@/components/app';
import { FormField } from '@/components/ui';
import type {
  RecurrenceRuleError,
  RecurrenceWeekOrdinal,
  RecurrenceWeekday,
} from '@/lib/domain';
import { useAppContext } from '@/providers';
import type { RecurrenceForm, RecurrenceFormKind } from './recurrence-form';

const weekdayOptions: RecurrenceWeekday[] = [0, 1, 2, 3, 4, 5, 6];
const ordinalOptions: RecurrenceWeekOrdinal[] = [1, 2, 3, 4, 'last'];

const optionBaseClassName =
  'touch-target h-8 rounded-full px-3 text-sm font-medium shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] disabled:cursor-not-allowed disabled:opacity-50';
const optionActiveClassName =
  'bg-[#f0c38e] text-[#253241] shadow-[0_12px_24px_rgba(240,195,142,0.16)]';
const optionIdleClassName =
  'bg-white/8 text-[#aebac8] enabled:hover:bg-[#f0c38e]/14 enabled:hover:text-[#fff9f2]';
const groupLabelClassName =
  'px-1 text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.24em] text-[#fff9f2]/90';

function optionClassName(isActive: boolean): string {
  return `${optionBaseClassName} ${isActive ? optionActiveClassName : optionIdleClassName}`;
}

function RadioOptions<T extends string | number>({
  disabled,
  label,
  options,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap items-center gap-2"
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={optionClassName(option.value === value)}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FieldGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <span className={groupLabelClassName}>{label}</span>
      {children}
    </div>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="px-1 text-xs text-rose-300">
      {message}
    </p>
  ) : null;
}

function keepDigits(value: string): string {
  return value.replace(/\D/gu, '').slice(0, 4);
}

function useFrequencyErrors(error: RecurrenceRuleError | null) {
  const labels = useAppContext().dictionary.recurring;

  return {
    anchor: error === 'anchor' ? labels.errorAnchor : null,
    day: error === 'day' ? labels.errorDay : null,
    interval: error === 'interval' ? labels.errorInterval : null,
    weekdays: error === 'weekdays' ? labels.errorWeekdays : null,
  };
}

interface KindFieldsProps {
  disabled: boolean;
  error: RecurrenceRuleError | null;
  form: RecurrenceForm;
  onChange: (update: Partial<RecurrenceForm>) => void;
}

function IntervalFields({ disabled, error, form, onChange }: KindFieldsProps) {
  const { dictionary } = useAppContext();
  const labels = dictionary.recurring;
  const errors = useFrequencyErrors(error);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        disabled={disabled}
        error={errors.interval}
        inputMode="numeric"
        label={labels.everyDaysLabel}
        value={form.everyDays}
        onChange={(event) =>
          onChange({ everyDays: keepDigits(event.target.value) })
        }
      />
      <div className="grid gap-1">
        <DatePicker
          disabled={disabled}
          label={labels.anchorLabel}
          placeholder={dictionary.calendar.bulkDatePlaceholder}
          value={form.intervalAnchor}
          onChange={(intervalAnchor) => onChange({ intervalAnchor })}
        />
        <ErrorMessage message={errors.anchor} />
      </div>
    </div>
  );
}

function WeeklyFields({ disabled, error, form, onChange }: KindFieldsProps) {
  const { dictionary } = useAppContext();
  const labels = dictionary.recurring;
  const errors = useFrequencyErrors(error);

  function toggleWeekday(weekday: RecurrenceWeekday) {
    onChange({
      weekdays: form.weekdays.includes(weekday)
        ? form.weekdays.filter((current) => current !== weekday)
        : [...form.weekdays, weekday],
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          disabled={disabled}
          error={errors.interval}
          inputMode="numeric"
          label={labels.everyWeeksLabel}
          value={form.everyWeeks}
          onChange={(event) =>
            onChange({ everyWeeks: keepDigits(event.target.value) })
          }
        />
        {Number(form.everyWeeks) > 1 ? (
          <div className="grid gap-1">
            <DatePicker
              disabled={disabled}
              label={labels.anchorLabel}
              placeholder={dictionary.calendar.bulkDatePlaceholder}
              value={form.weeklyAnchor}
              onChange={(weeklyAnchor) => onChange({ weeklyAnchor })}
            />
            <ErrorMessage message={errors.anchor} />
          </div>
        ) : null}
      </div>
      <FieldGroup label={labels.weekdaysLabel}>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {weekdayOptions.map((weekday) => (
            <button
              key={weekday}
              type="button"
              aria-pressed={form.weekdays.includes(weekday)}
              className={optionClassName(form.weekdays.includes(weekday))}
              disabled={disabled}
              onClick={() => toggleWeekday(weekday)}
            >
              {dictionary.calendar.weekdays[weekday]}
            </button>
          ))}
        </div>
        <ErrorMessage message={errors.weekdays} />
      </FieldGroup>
    </div>
  );
}

function MonthlyFields({ disabled, error, form, onChange }: KindFieldsProps) {
  const { dictionary } = useAppContext();
  const labels = dictionary.recurring;
  const errors = useFrequencyErrors(error);

  return (
    <div className="grid gap-4">
      <RadioOptions<RecurrenceFormKind>
        disabled={disabled}
        label={labels.kindMonthly}
        options={[
          { label: labels.monthlyDay, value: 'monthly_day' },
          { label: labels.monthlyLastDay, value: 'monthly_last_day' },
          { label: labels.monthlyWeekday, value: 'monthly_weekday' },
        ]}
        value={form.kind}
        onChange={(kind) => onChange({ kind })}
      />
      {form.kind === 'monthly_day' ? (
        <div className="grid gap-1 sm:max-w-xs">
          <FormField
            disabled={disabled}
            error={errors.day}
            inputMode="numeric"
            label={labels.dayOfMonthLabel}
            value={form.day}
            onChange={(event) =>
              onChange({ day: keepDigits(event.target.value).slice(0, 2) })
            }
          />
          <p className="px-1 text-xs text-[#aebac8]">{labels.missingDayHint}</p>
        </div>
      ) : null}
      {form.kind === 'monthly_weekday' ? (
        <div className="grid gap-4">
          <FieldGroup label={labels.positionLabel}>
            <RadioOptions<RecurrenceWeekOrdinal>
              disabled={disabled}
              label={labels.positionLabel}
              options={ordinalOptions.map((ordinal) => ({
                label:
                  labels.ordinals[ordinal][
                    labels.weekdayOrdinalForms[form.weekday]
                  ],
                value: ordinal,
              }))}
              value={form.ordinal}
              onChange={(ordinal) => onChange({ ordinal })}
            />
          </FieldGroup>
          <FieldGroup label={labels.weekdaysLabel}>
            <RadioOptions<RecurrenceWeekday>
              disabled={disabled}
              label={labels.weekdaysLabel}
              options={weekdayOptions.map((weekday) => ({
                label: dictionary.calendar.weekdays[weekday],
                value: weekday,
              }))}
              value={form.weekday}
              onChange={(weekday) => onChange({ weekday })}
            />
          </FieldGroup>
        </div>
      ) : null}
    </div>
  );
}

type KindTab = 'interval' | 'weekly' | 'monthly';

function getKindTab(kind: RecurrenceFormKind): KindTab {
  return kind === 'interval' || kind === 'weekly' ? kind : 'monthly';
}

export function RecurringFrequencyFields(props: KindFieldsProps) {
  const labels = useAppContext().dictionary.recurring;
  const { disabled, form, onChange } = props;
  const tab = getKindTab(form.kind);

  return (
    <fieldset className="grid gap-4">
      <legend className={`${groupLabelClassName} mb-2`}>
        {labels.frequency}
      </legend>
      {disabled ? (
        <p className="px-1 text-xs text-[#f7d7ad]">
          {labels.pausedFrequencyHint}
        </p>
      ) : null}
      <RadioOptions<KindTab>
        disabled={disabled}
        label={labels.frequency}
        options={[
          { label: labels.kindInterval, value: 'interval' },
          { label: labels.kindWeekly, value: 'weekly' },
          { label: labels.kindMonthly, value: 'monthly' },
        ]}
        value={tab}
        onChange={(nextTab) =>
          onChange({ kind: nextTab === 'monthly' ? 'monthly_day' : nextTab })
        }
      />
      {tab === 'interval' ? <IntervalFields {...props} /> : null}
      {tab === 'weekly' ? <WeeklyFields {...props} /> : null}
      {tab === 'monthly' ? <MonthlyFields {...props} /> : null}
    </fieldset>
  );
}
