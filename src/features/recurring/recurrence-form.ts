import {
  normalizeMeasureUnit,
  parseQuantityInput,
  validateRecurrenceMeasure,
  validateRecurrenceRule,
  type LocalDateString,
  type SupportedLocale,
  type RecurrenceChild,
  type RecurrenceMeasure,
  type RecurrenceMeasureError,
  type RecurrenceRule,
  type RecurrenceRuleError,
  type RecurrenceWeekOrdinal,
  type RecurrenceWeekday,
} from '@/lib/domain';
import {
  filterBulkChecklistDraftItems,
  type BulkChecklistDraftItem,
} from '@/features/calendar/bulk-checklist-draft';
import { formatQuantity } from '@/lib/i18n';
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
  locale: SupportedLocale = 'pt-BR',
): RecurrenceForm {
  const todayInput = formatDateInputValue(today, locale);

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
  locale: SupportedLocale = 'pt-BR',
): RecurrenceForm {
  const form = createDefaultRecurrenceForm(today, locale);

  switch (rule.kind) {
    case 'interval':
      return {
        ...form,
        kind: rule.kind,
        everyDays: String(rule.everyDays),
        intervalAnchor: formatDateInputValue(rule.anchorDate, locale),
      };
    case 'weekly':
      return {
        ...form,
        kind: rule.kind,
        everyWeeks: String(rule.everyWeeks),
        weekdays: rule.weekdays,
        weeklyAnchor: rule.anchorDate
          ? formatDateInputValue(rule.anchorDate, locale)
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
  locale: SupportedLocale = 'pt-BR',
): unknown {
  const everyDays = parsePositiveInteger(form.everyDays);
  const anchorDate = parseDateInputValue(form.intervalAnchor, locale);

  return {
    kind: 'interval',
    everyDays,
    anchorDate: anchorDate ?? (everyDays === 1 ? today : null),
  };
}

function buildWeeklyRule(
  form: RecurrenceForm,
  locale: SupportedLocale,
): unknown {
  const everyWeeks = parsePositiveInteger(form.everyWeeks);

  return {
    kind: 'weekly',
    everyWeeks,
    weekdays: [...form.weekdays].sort(),
    anchorDate:
      everyWeeks > 1 ? parseDateInputValue(form.weeklyAnchor, locale) : null,
  };
}

function buildCandidateRule(
  form: RecurrenceForm,
  today: LocalDateString,
  locale: SupportedLocale = 'pt-BR',
): unknown {
  switch (form.kind) {
    case 'interval':
      return buildIntervalRule(form, today, locale);
    case 'weekly':
      return buildWeeklyRule(form, locale);
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
  locale: SupportedLocale = 'pt-BR',
): RecurrenceFormResult {
  const candidate = buildCandidateRule(form, today, locale);
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
  measures: Readonly<Record<string, RecurrenceMeasure | null>> = {},
): RecurrenceChild[] {
  return filterBulkChecklistDraftItems(items).map((item) => ({
    id: item.id,
    parentId: item.parentId,
    text: item.text.trim(),
    bold: item.bold,
    priority: item.priority,
    sortRank: item.sortRank,
    measure: measures[item.id] ?? null,
  }));
}

export interface MeasureDraft {
  enabled: boolean;
  target: string;
  unit: string;
}

export type MeasureDraftResult =
  | { measure: RecurrenceMeasure | null }
  | { error: RecurrenceMeasureError };

export function createMeasureDraft(
  measure: RecurrenceMeasure | null | undefined,
  locale: string,
): MeasureDraft {
  if (!measure) {
    return { enabled: false, target: '', unit: '' };
  }

  return {
    enabled: true,
    target: formatQuantity(measure.target, locale),
    unit: measure.unit,
  };
}

export function readMeasureDraft(draft: MeasureDraft): MeasureDraftResult {
  if (!draft.enabled) {
    return { measure: null };
  }

  const target = parseQuantityInput(draft.target);
  const measure = {
    target: target ?? 0,
    unit: normalizeMeasureUnit(draft.unit),
  };
  const error = target === null ? 'target' : validateRecurrenceMeasure(measure);

  return error ? { error } : { measure };
}

export function findMeasuredGroups(
  items: readonly BulkChecklistDraftItem[],
  drafts: Readonly<Record<string, MeasureDraft>>,
): string[] {
  return items
    .filter(
      (item) =>
        drafts[item.id]?.enabled &&
        items.some((child) => child.parentId === item.id),
    )
    .map((item) => item.id);
}

export interface EditorMeasures {
  childMeasures: Record<string, RecurrenceMeasure | null>;
  measure: RecurrenceMeasure | null;
}

export interface EditorMeasureErrors {
  blocked: boolean;
  children: Record<string, RecurrenceMeasureError>;
  root: RecurrenceMeasureError | undefined;
}

const disabledMeasureDraft: MeasureDraft = {
  enabled: false,
  target: '',
  unit: '',
};

function readChildMeasures(
  items: readonly BulkChecklistDraftItem[],
  childDrafts: Readonly<Record<string, MeasureDraft>>,
) {
  const errors: Record<string, RecurrenceMeasureError> = {};
  const measures: Record<string, RecurrenceMeasure | null> = {};

  for (const item of items) {
    const result = readMeasureDraft(
      childDrafts[item.id] ?? disabledMeasureDraft,
    );

    if ('error' in result) {
      errors[item.id] = result.error;
    } else if (result.measure) {
      measures[item.id] = result.measure;
    }
  }

  return { errors, measures };
}

export function collectEditorMeasures({
  childDrafts,
  items,
  measureDraft,
}: {
  childDrafts: Readonly<Record<string, MeasureDraft>>;
  items: BulkChecklistDraftItem[];
  measureDraft: MeasureDraft;
}): { errors: EditorMeasureErrors | null; measures: EditorMeasures } {
  const hasChildren = filterBulkChecklistDraftItems(items).length > 0;
  const root = hasChildren ? { measure: null } : readMeasureDraft(measureDraft);
  const children = readChildMeasures(items, childDrafts);
  const errors: EditorMeasureErrors = {
    blocked:
      (measureDraft.enabled && hasChildren) ||
      findMeasuredGroups(items, childDrafts).length > 0,
    children: children.errors,
    root: 'error' in root ? root.error : undefined,
  };
  const hasErrors =
    errors.blocked ||
    errors.root !== undefined ||
    Object.keys(errors.children).length > 0;

  return {
    errors: hasErrors ? errors : null,
    measures: {
      childMeasures: children.measures,
      measure: 'measure' in root ? root.measure : null,
    },
  };
}
