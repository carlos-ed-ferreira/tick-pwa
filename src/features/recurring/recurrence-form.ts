import {
  validateRecurrenceRule,
  type LocalDateString,
  type RecurrenceChild,
  type RecurrenceRule,
  type RecurrenceRuleError,
  type RecurrenceWeekOrdinal,
  type RecurrenceWeekday,
} from '@/lib/domain';
import {
  filterBulkChecklistDraftItems,
  type BulkChecklistDraftItem,
} from '@/features/calendar/bulk-checklist-draft';
import {
  formatDateInputValue,
  getLocalDateWeekday,
  parseDateInputValue,
} from '@/lib/time';

export type RecurrenceFormKind = RecurrenceRule['kind'];

export interface RecurrenceForm {
  kind: RecurrenceFormKind;
  everyDays: string;
  intervalAnchor: string;
  everyWeeks: string;
  weekdays: RecurrenceWeekday[];
  weeklyAnchor: string;
  day: string;
  ordinal: RecurrenceWeekOrdinal;
  weekday: RecurrenceWeekday;
}

export type RecurrenceFormResult =
  | { rule: RecurrenceRule }
  | { error: RecurrenceRuleError };

export function createDefaultRecurrenceForm(
  today: LocalDateString,
): RecurrenceForm {
  const todayInput = formatDateInputValue(today);

  return {
    kind: 'interval',
    everyDays: '1',
    intervalAnchor: todayInput,
    everyWeeks: '1',
    weekdays: [],
    weeklyAnchor: todayInput,
    day: today.slice(8).replace(/^0/u, ''),
    ordinal: 1,
    weekday: getLocalDateWeekday(today),
  };
}

export function createFormFromRule(
  rule: RecurrenceRule,
  today: LocalDateString,
): RecurrenceForm {
  const form = createDefaultRecurrenceForm(today);

  switch (rule.kind) {
    case 'interval':
      return {
        ...form,
        kind: rule.kind,
        everyDays: String(rule.everyDays),
        intervalAnchor: formatDateInputValue(rule.anchorDate),
      };
    case 'weekly':
      return {
        ...form,
        kind: rule.kind,
        everyWeeks: String(rule.everyWeeks),
        weekdays: rule.weekdays,
        weeklyAnchor: rule.anchorDate
          ? formatDateInputValue(rule.anchorDate)
          : form.weeklyAnchor,
      };
    case 'monthly_day':
      return { ...form, kind: rule.kind, day: String(rule.day) };
    case 'monthly_last_day':
      return { ...form, kind: rule.kind };
    case 'monthly_weekday':
      return {
        ...form,
        kind: rule.kind,
        ordinal: rule.ordinal,
        weekday: rule.weekday,
      };
  }
}

function parsePositiveInteger(value: string): number {
  return /^\d+$/u.test(value.trim()) ? Number(value) : 0;
}

function buildIntervalRule(
  form: RecurrenceForm,
  today: LocalDateString,
): unknown {
  const everyDays = parsePositiveInteger(form.everyDays);
  const anchorDate = parseDateInputValue(form.intervalAnchor);

  return {
    kind: 'interval',
    everyDays,
    anchorDate: anchorDate ?? (everyDays === 1 ? today : null),
  };
}

function buildWeeklyRule(form: RecurrenceForm): unknown {
  const everyWeeks = parsePositiveInteger(form.everyWeeks);

  return {
    kind: 'weekly',
    everyWeeks,
    weekdays: [...form.weekdays].sort(),
    anchorDate: everyWeeks > 1 ? parseDateInputValue(form.weeklyAnchor) : null,
  };
}

function buildCandidateRule(
  form: RecurrenceForm,
  today: LocalDateString,
): unknown {
  switch (form.kind) {
    case 'interval':
      return buildIntervalRule(form, today);
    case 'weekly':
      return buildWeeklyRule(form);
    case 'monthly_day':
      return { kind: 'monthly_day', day: parsePositiveInteger(form.day) };
    case 'monthly_last_day':
      return { kind: 'monthly_last_day' };
    case 'monthly_weekday':
      return {
        kind: 'monthly_weekday',
        ordinal: form.ordinal,
        weekday: form.weekday,
      };
  }
}

export function buildRuleFromForm(
  form: RecurrenceForm,
  today: LocalDateString,
): RecurrenceFormResult {
  const candidate = buildCandidateRule(form, today);
  const error = validateRecurrenceRule(candidate);

  return error ? { error } : { rule: candidate as RecurrenceRule };
}

export function childrenToDraftItems(
  children: readonly RecurrenceChild[],
): BulkChecklistDraftItem[] {
  return children.map((child) => ({
    ...child,
    scheduledTime: null,
    checked: false,
    ignored: false,
    markLevel: 0,
    collapsed: false,
    categoryTagId: null,
  }));
}

export function draftItemsToChildren(
  items: BulkChecklistDraftItem[],
): RecurrenceChild[] {
  return filterBulkChecklistDraftItems(items).map((item) => ({
    id: item.id,
    parentId: item.parentId,
    text: item.text.trim(),
    bold: item.bold,
    priority: item.priority,
    sortRank: item.sortRank,
  }));
}
