import type { CalendarImportDay, CalendarImportItem } from '@/lib/db';
import type { LocalDateString } from '@/lib/domain';
import { createId, createSortRankBetween } from '@/lib/domain';
import { createLocalDateKey, parseLocalDateKey } from '@/lib/time';

export const MAX_IMPORT_DAYS = 366;
export const MAX_IMPORT_ITEMS = 2000;

export type CalendarImportErrorCode =
  | 'emptyPayload'
  | 'invalidCategory'
  | 'invalidChildren'
  | 'invalidColor'
  | 'invalidDate'
  | 'invalidDay'
  | 'invalidItem'
  | 'invalidItems'
  | 'invalidJson'
  | 'invalidPriority'
  | 'invalidRoot'
  | 'invalidTime'
  | 'limitExceeded'
  | 'requireText';

export interface CalendarImportError {
  code: CalendarImportErrorCode;
  path: string;
  detail?: string;
}

export type CalendarImportParseResult =
  | { ok: true; days: CalendarImportDay[]; itemCount: number }
  | { ok: false; errors: CalendarImportError[] };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDateValue(value: unknown): LocalDateString | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearPart, monthPart, dayPart] = value.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const localDate = createLocalDateKey(year, month - 1, day);
  const parsedDate = parseLocalDateKey(localDate);

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  return localDate;
}

function parseTimeValue(value: unknown): string | null | 'invalid' {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return 'invalid';
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return 'invalid';
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return 'invalid';
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getDaysInput(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.days)) {
    return payload.days;
  }

  return null;
}

export function parseCalendarImportPayload(
  rawJson: string,
): CalendarImportParseResult {
  let payload: unknown;

  try {
    payload = JSON.parse(rawJson);
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          code: 'invalidJson',
          path: '',
          detail: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }

  const daysInput = getDaysInput(payload);

  if (!daysInput) {
    return { ok: false, errors: [{ code: 'invalidRoot', path: '' }] };
  }

  const errors: CalendarImportError[] = [];
  const days: CalendarImportDay[] = [];
  let itemCount = 0;

  function collectItems({
    input,
    path,
    parentId,
    target,
  }: {
    input: unknown[];
    path: string;
    parentId: string | null;
    target: CalendarImportItem[];
  }): void {
    let previousSortRank: string | null = null;

    input.forEach((rawItem, itemIndex) => {
      const itemPath = `${path}[${itemIndex}]`;

      if (!isRecord(rawItem)) {
        errors.push({ code: 'invalidItem', path: itemPath });
        return;
      }

      const text = typeof rawItem.text === 'string' ? rawItem.text.trim() : '';

      if (!text) {
        errors.push({ code: 'requireText', path: `${itemPath}.text` });
        return;
      }

      const scheduledTime = parseTimeValue(rawItem.time);

      if (scheduledTime === 'invalid') {
        errors.push({ code: 'invalidTime', path: `${itemPath}.time` });
      }

      if (
        rawItem.priority !== undefined &&
        rawItem.priority !== null &&
        typeof rawItem.priority !== 'boolean'
      ) {
        errors.push({ code: 'invalidPriority', path: `${itemPath}.priority` });
      }

      let category: CalendarImportItem['category'] = null;

      if (rawItem.category !== undefined && rawItem.category !== null) {
        const rawCategory = rawItem.category;
        const categoryName =
          isRecord(rawCategory) && typeof rawCategory.name === 'string'
            ? rawCategory.name.trim()
            : '';
        const categoryColor =
          isRecord(rawCategory) && typeof rawCategory.color === 'string'
            ? rawCategory.color.trim()
            : '';

        if (!categoryName || !categoryColor) {
          errors.push({
            code: 'invalidCategory',
            path: `${itemPath}.category`,
          });
        } else if (!/^#[0-9a-fA-F]{6}$/.test(categoryColor)) {
          errors.push({
            code: 'invalidColor',
            path: `${itemPath}.category.color`,
          });
        } else {
          category = {
            name: categoryName,
            colorHex: categoryColor.toLowerCase(),
          };
        }
      }

      const sortRank = createSortRankBetween(previousSortRank, null);
      previousSortRank = sortRank;

      const item: CalendarImportItem = {
        id: createId(),
        parentId,
        text,
        scheduledTime: scheduledTime === 'invalid' ? null : scheduledTime,
        checked: false,
        ignored: false,
        markLevel: 0,
        bold: false,
        priority: rawItem.priority === true,
        collapsed: false,
        category,
        sortRank,
      };

      target.push(item);
      itemCount += 1;

      if (rawItem.children === undefined || rawItem.children === null) {
        return;
      }

      if (!Array.isArray(rawItem.children)) {
        errors.push({ code: 'invalidChildren', path: `${itemPath}.children` });
        return;
      }

      collectItems({
        input: rawItem.children,
        path: `${itemPath}.children`,
        parentId: item.id,
        target,
      });
    });
  }

  daysInput.forEach((rawDay, dayIndex) => {
    const dayPath = `days[${dayIndex}]`;

    if (!isRecord(rawDay)) {
      errors.push({ code: 'invalidDay', path: dayPath });
      return;
    }

    const date = parseDateValue(rawDay.date);

    if (!date) {
      errors.push({ code: 'invalidDate', path: `${dayPath}.date` });
      return;
    }

    if (!Array.isArray(rawDay.items)) {
      errors.push({ code: 'invalidItems', path: `${dayPath}.items` });
      return;
    }

    const items: CalendarImportItem[] = [];
    collectItems({
      input: rawDay.items,
      path: `${dayPath}.items`,
      parentId: null,
      target: items,
    });

    if (items.length > 0) {
      days.push({ date, items });
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (daysInput.length > MAX_IMPORT_DAYS || itemCount > MAX_IMPORT_ITEMS) {
    return { ok: false, errors: [{ code: 'limitExceeded', path: '' }] };
  }

  if (days.length === 0) {
    return { ok: false, errors: [{ code: 'emptyPayload', path: '' }] };
  }

  return { ok: true, days, itemCount };
}
