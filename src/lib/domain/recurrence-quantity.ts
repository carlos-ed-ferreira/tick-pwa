import type {
  RecurrenceContent,
  RecurrenceMeasure,
  RecurrenceQuantity,
  RecurrenceResponseStatus,
} from './types';

export type RecurrenceQuantityOutcome = 'done' | 'partial' | 'zero';
export type RecurrenceMeasureError = 'target' | 'unit';

export interface RecurrenceQuantitySummary {
  capped: number;
  count: number;
  done: number;
  expected: number;
  partial: number;
  progress: number;
  realized: number;
  unit: string;
  zero: number;
}

export const MAX_RECURRENCE_QUANTITY = 1_000_000;
export const MAX_RECURRENCE_UNIT_LENGTH = 24;

const SCALE = 1000;

function toMilli(value: number): number {
  return Math.round(value * SCALE);
}

function fromMilli(value: number): number {
  return value / SCALE;
}

function hasSupportedPrecision(value: number): boolean {
  return Math.abs(value * SCALE - toMilli(value)) < 1e-6;
}

export function validateQuantityValue(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_RECURRENCE_QUANTITY &&
    hasSupportedPrecision(value)
  );
}

export function normalizeMeasureUnit(unit: string): string {
  return unit.trim().replace(/\s+/gu, ' ');
}

export function validateRecurrenceMeasure(
  measure: RecurrenceMeasure,
): RecurrenceMeasureError | null {
  if (!validateQuantityValue(measure.target) || toMilli(measure.target) <= 0) {
    return 'target';
  }

  const unit = normalizeMeasureUnit(measure.unit);

  return unit.length === 0 || unit.length > MAX_RECURRENCE_UNIT_LENGTH
    ? 'unit'
    : null;
}

export function parseQuantityInput(input: string): number | null {
  const normalized = input.trim().replace(',', '.');

  if (!/^\d+(\.\d+)?$/u.test(normalized)) {
    return null;
  }

  const value = Number(normalized);

  return validateQuantityValue(value) ? value : null;
}

export function getQuantityOutcome(
  quantity: RecurrenceQuantity,
): RecurrenceQuantityOutcome {
  const value = toMilli(quantity.value);

  if (value >= toMilli(quantity.target)) {
    return 'done';
  }

  return value > 0 ? 'partial' : 'zero';
}

export function getQuantityStatus(
  quantity: RecurrenceQuantity,
): RecurrenceResponseStatus {
  return getQuantityOutcome(quantity) === 'done' ? 'done' : 'not_done';
}

export function getQuantityProgress(quantity: RecurrenceQuantity): number {
  return Math.min(toMilli(quantity.value) / toMilli(quantity.target), 1);
}

export function isMeasurableItem(
  content: RecurrenceContent,
  itemId: string | null,
): boolean {
  if (itemId === null) {
    return content.children.length === 0;
  }

  return (
    content.children.some((child) => child.id === itemId) &&
    !content.children.some((child) => child.parentId === itemId)
  );
}

export function getItemMeasure(
  content: RecurrenceContent,
  itemId: string | null,
): RecurrenceMeasure | null {
  if (!isMeasurableItem(content, itemId)) {
    return null;
  }

  const measure =
    itemId === null
      ? content.measure
      : content.children.find((child) => child.id === itemId)?.measure;

  return measure ?? null;
}

export function summarizeQuantities(
  quantities: readonly RecurrenceQuantity[],
): RecurrenceQuantitySummary[] {
  const byUnit = new Map<string, Omit<RecurrenceQuantitySummary, 'progress'>>();

  for (const quantity of quantities) {
    const outcome = getQuantityOutcome(quantity);
    const target = toMilli(quantity.target);
    const value = toMilli(quantity.value);
    const entry = byUnit.get(quantity.unit) ?? {
      capped: 0,
      count: 0,
      done: 0,
      expected: 0,
      partial: 0,
      realized: 0,
      unit: quantity.unit,
      zero: 0,
    };

    entry.count += 1;
    entry[outcome] += 1;
    entry.capped += Math.min(value, target);
    entry.expected += target;
    entry.realized += value;
    byUnit.set(quantity.unit, entry);
  }

  return [...byUnit.values()].map(
    ({ capped, expected, realized, ...entry }) => ({
      ...entry,
      capped: fromMilli(capped),
      expected: fromMilli(expected),
      progress: (capped / expected) * 100,
      realized: fromMilli(realized),
    }),
  );
}
