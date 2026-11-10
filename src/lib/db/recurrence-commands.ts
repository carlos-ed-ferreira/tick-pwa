import type {
  AppScope,
  LocalDateString,
  Recurrence,
  RecurrenceContent,
  RecurrenceMeasure,
  RecurrenceQuantity,
  RecurrenceResponse,
  RecurrenceResponseStatus,
  RecurrenceRule,
} from '@/lib/domain';
import {
  appendScheduleSegment,
  buildRecurrenceResponseId,
  canRespondOnDate,
  createId,
  getItemMeasure,
  getOccurrencesForDate,
  getQuantityStatus,
  isMeasurableItem,
  isRecurrencePaused,
  isSameRecurrenceContent,
  normalizeMeasureUnit,
  pauseSchedule,
  pickRecurrenceContent,
  replaceContentForward,
  resumeSchedule,
  validateQuantityValue,
  validateRecurrenceMeasure,
  validateRecurrenceRule,
} from '@/lib/domain';
import { addLocalDays } from '@/lib/time';
import { persistAccountEntityChange } from './account-persistence';
import { db } from './database';
import {
  createSyncMetadata,
  createTimestamp,
  getEntitySyncStatus,
} from './entity-metadata';

export type RecurrenceContentMode = 'all' | 'forward';

function assertValidRule(rule: RecurrenceRule): void {
  if (validateRecurrenceRule(rule) !== null) {
    throw new Error('invalid_recurrence_rule');
  }
}

async function resolveCategoryTagId(
  scope: AppScope,
  categoryTagId: string | null,
): Promise<string | null> {
  if (!categoryTagId) {
    return null;
  }

  const categoryTag = await db.categoryTags.get(categoryTagId);

  return categoryTag &&
    categoryTag.scopeId === scope.id &&
    categoryTag.deletedAt === null &&
    categoryTag.surface === 'recurrence'
    ? categoryTag.id
    : null;
}

function normalizeMeasure(
  measure: RecurrenceMeasure | null | undefined,
  measurable: boolean,
): RecurrenceMeasure | null {
  if (!measure) {
    return null;
  }

  const normalized = {
    target: measure.target,
    unit: normalizeMeasureUnit(measure.unit),
  };

  if (!measurable || validateRecurrenceMeasure(normalized) !== null) {
    throw new Error('invalid_recurrence_measure');
  }

  return normalized;
}

async function normalizeContent(
  scope: AppScope,
  content: RecurrenceContent,
): Promise<RecurrenceContent> {
  const text = content.text.trim();

  if (!text) {
    throw new Error('invalid_recurrence_text');
  }

  const picked = pickRecurrenceContent(content);

  return {
    ...picked,
    text,
    categoryTagId: await resolveCategoryTagId(scope, content.categoryTagId),
    children: picked.children.map((child) => ({
      ...child,
      measure: normalizeMeasure(
        child.measure,
        isMeasurableItem(picked, child.id),
      ),
    })),
    measure: normalizeMeasure(picked.measure, isMeasurableItem(picked, null)),
  };
}

function getMeasureKey(content: RecurrenceContent): string {
  const picked = pickRecurrenceContent(content);

  return JSON.stringify([
    picked.measure,
    picked.children.map((child) => [child.id, child.measure]),
  ]);
}

async function getScopedRecurrence(
  scope: AppScope,
  recurrenceId: string,
): Promise<Recurrence | null> {
  const recurrence = await db.recurrences.get(recurrenceId);

  return recurrence &&
    recurrence.scopeId === scope.id &&
    recurrence.deletedAt === null
    ? recurrence
    : null;
}

function getRecurrenceResponses(
  scope: AppScope,
  recurrenceId: string,
): Promise<RecurrenceResponse[]> {
  return db.recurrenceResponses
    .where('[scopeId+recurrenceId]')
    .equals([scope.id, recurrenceId])
    .toArray();
}

function touchEntity<T extends Recurrence | RecurrenceResponse>(
  scope: AppScope,
  entity: T,
): T {
  const now = createTimestamp();

  return {
    ...entity,
    updatedAt: now,
    syncStatus: getEntitySyncStatus(scope),
    clientUpdatedAt: now,
  };
}

async function persistRecurrence(
  scope: AppScope,
  recurrence: Recurrence,
  changedFields: string[],
): Promise<void> {
  await db.recurrences.put(recurrence);
  await persistAccountEntityChange({
    scope,
    entityType: 'recurrence',
    entityId: recurrence.id,
    operation: recurrence.deletedAt ? 'delete' : 'upsert',
    payload: recurrence as unknown as Record<string, unknown>,
    changedFields,
    baseRevision: recurrence.remoteRevision,
  });
}

async function persistResponse(
  scope: AppScope,
  response: RecurrenceResponse,
  changedFields: string[],
): Promise<void> {
  await db.recurrenceResponses.put(response);
  await persistAccountEntityChange({
    scope,
    entityType: 'recurrenceResponse',
    entityId: response.id,
    operation: response.deletedAt ? 'delete' : 'upsert',
    payload: response as unknown as Record<string, unknown>,
    changedFields,
    baseRevision: response.remoteRevision,
  });
}

export async function createRecurrence({
  content,
  rule,
  scope,
}: {
  content: RecurrenceContent;
  rule: RecurrenceRule;
  scope: AppScope;
}): Promise<Recurrence> {
  assertValidRule(rule);

  return db.transaction(
    'rw',
    db.syncOutbox,
    db.recurrences,
    db.categoryTags,
    async () => {
      const now = createTimestamp();
      const recurrence: Recurrence = {
        id: createId(),
        scopeId: scope.id,
        ...(await normalizeContent(scope, content)),
        schedule: [{ from: null, rule }],
        contentHistory: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...createSyncMetadata(scope, now),
      };

      await db.recurrences.add(recurrence);
      await persistAccountEntityChange({
        scope,
        entityType: 'recurrence',
        entityId: recurrence.id,
        operation: 'upsert',
        payload: recurrence as unknown as Record<string, unknown>,
        changedFields: ['created'],
        baseRevision: null,
      });

      return recurrence;
    },
  );
}

async function resolveForwardCut(
  scope: AppScope,
  recurrenceId: string,
  today: LocalDateString,
): Promise<LocalDateString> {
  const responses = await getRecurrenceResponses(scope, recurrenceId);
  const answeredToday = responses.some(
    (response) => response.date === today && response.deletedAt === null,
  );

  return answeredToday ? addLocalDays(today, 1) : today;
}

async function applyContentChange({
  content,
  contentMode,
  recurrence,
  scope,
  today,
}: {
  content: RecurrenceContent;
  contentMode: RecurrenceContentMode;
  recurrence: Recurrence;
  scope: AppScope;
  today: LocalDateString;
}): Promise<Recurrence> {
  const nextContent = await normalizeContent(scope, content);

  if (isSameRecurrenceContent(recurrence, nextContent)) {
    return recurrence;
  }

  if (
    getMeasureKey(recurrence) !== getMeasureKey(nextContent) &&
    (await getRecurrenceResponses(scope, recurrence.id)).length > 0
  ) {
    return replaceContentForward(
      recurrence,
      nextContent,
      addLocalDays(today, 1),
    );
  }

  return contentMode === 'forward'
    ? replaceContentForward(
        recurrence,
        nextContent,
        await resolveForwardCut(scope, recurrence.id, today),
      )
    : { ...recurrence, ...nextContent, contentHistory: [] };
}

function applyRuleChange(
  recurrence: Recurrence,
  rule: RecurrenceRule | undefined,
  today: LocalDateString,
): Recurrence {
  if (!rule || isRecurrencePaused(recurrence.schedule)) {
    return recurrence;
  }

  assertValidRule(rule);

  const schedule = appendScheduleSegment(recurrence.schedule, today, rule);

  return schedule === recurrence.schedule
    ? recurrence
    : { ...recurrence, schedule };
}

export async function updateRecurrence({
  content,
  contentMode = 'all',
  recurrenceId,
  rule,
  scope,
  today,
}: {
  content?: RecurrenceContent;
  contentMode?: RecurrenceContentMode;
  recurrenceId: string;
  rule?: RecurrenceRule;
  scope: AppScope;
  today: LocalDateString;
}): Promise<void> {
  await db.transaction(
    'rw',
    [db.syncOutbox, db.recurrences, db.recurrenceResponses, db.categoryTags],
    async () => {
      const recurrence = await getScopedRecurrence(scope, recurrenceId);

      if (!recurrence) {
        return;
      }

      const withContent = content
        ? await applyContentChange({
            content,
            contentMode,
            recurrence,
            scope,
            today,
          })
        : recurrence;
      const updated = applyRuleChange(withContent, rule, today);

      if (updated !== recurrence) {
        await persistRecurrence(scope, touchEntity(scope, updated), [
          'content',
          'schedule',
        ]);
      }
    },
  );
}

async function updateSchedule(
  scope: AppScope,
  recurrenceId: string,
  createSchedule: (recurrence: Recurrence) => Recurrence['schedule'],
): Promise<void> {
  await db.transaction('rw', db.syncOutbox, db.recurrences, async () => {
    const recurrence = await getScopedRecurrence(scope, recurrenceId);

    if (!recurrence) {
      return;
    }

    await persistRecurrence(
      scope,
      touchEntity(scope, {
        ...recurrence,
        schedule: createSchedule(recurrence),
      }),
      ['schedule'],
    );
  });
}

export async function pauseRecurrence({
  recurrenceId,
  scope,
  today,
}: {
  recurrenceId: string;
  scope: AppScope;
  today: LocalDateString;
}): Promise<void> {
  await updateSchedule(scope, recurrenceId, (recurrence) =>
    pauseSchedule(recurrence.schedule, today),
  );
}

export async function resumeRecurrence({
  recurrenceId,
  scope,
  today,
}: {
  recurrenceId: string;
  scope: AppScope;
  today: LocalDateString;
}): Promise<void> {
  await updateSchedule(scope, recurrenceId, (recurrence) =>
    resumeSchedule(recurrence.schedule, today),
  );
}

export async function softDeleteRecurrence({
  recurrenceId,
  scope,
}: {
  recurrenceId: string;
  scope: AppScope;
}): Promise<void> {
  await db.transaction(
    'rw',
    db.syncOutbox,
    db.recurrences,
    db.recurrenceResponses,
    async () => {
      const recurrence = await getScopedRecurrence(scope, recurrenceId);

      if (!recurrence) {
        return;
      }

      const responses = await getRecurrenceResponses(scope, recurrenceId);
      const deletedAt = createTimestamp();

      await persistRecurrence(
        scope,
        touchEntity(scope, { ...recurrence, deletedAt }),
        ['deletedAt'],
      );

      for (const response of responses) {
        if (response.deletedAt === null) {
          await persistResponse(
            scope,
            touchEntity(scope, { ...response, deletedAt }),
            ['deletedAt'],
          );
        }
      }
    },
  );
}

async function getAnswerableContent({
  date,
  itemId,
  recurrence,
  scope,
}: {
  date: LocalDateString;
  itemId: string | null;
  recurrence: Recurrence;
  scope: AppScope;
}): Promise<RecurrenceContent | null> {
  const [occurrence] = getOccurrencesForDate({
    date,
    recurrences: [recurrence],
    responses: await getRecurrenceResponses(scope, recurrence.id),
  });

  if (
    !occurrence ||
    (itemId !== null &&
      !occurrence.content.children.some((child) => child.id === itemId))
  ) {
    return null;
  }

  return occurrence.content;
}

interface ResponseAnswer {
  quantity: RecurrenceQuantity | null;
  status: RecurrenceResponseStatus;
}

function isSameAnswer(
  existing: RecurrenceResponse | undefined,
  answer: ResponseAnswer | null,
): boolean {
  if (!existing || existing.deletedAt) {
    return answer === null;
  }

  return (
    answer !== null &&
    existing.status === answer.status &&
    JSON.stringify(existing.quantity ?? null) ===
      JSON.stringify(answer.quantity)
  );
}

async function writeResponse({
  answer,
  date,
  itemId,
  recurrenceId,
  scope,
}: {
  answer: ResponseAnswer | null;
  date: LocalDateString;
  itemId: string | null;
  recurrenceId: string;
  scope: AppScope;
}): Promise<void> {
  const id = buildRecurrenceResponseId({
    date,
    itemId,
    recurrenceId,
    scopeId: scope.id,
  });
  const existing = await db.recurrenceResponses.get(id);

  if (isSameAnswer(existing, answer)) {
    return;
  }

  if (!existing) {
    const now = createTimestamp();

    await persistResponse(
      scope,
      {
        id,
        scopeId: scope.id,
        recurrenceId,
        date,
        itemId,
        ...(answer as ResponseAnswer),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...createSyncMetadata(scope, now),
      },
      ['created'],
    );
    return;
  }

  const next = touchEntity(scope, existing);

  await persistResponse(
    scope,
    answer
      ? { ...next, ...answer, deletedAt: null }
      : { ...next, deletedAt: next.updatedAt },
    ['status', 'quantity', 'deletedAt'],
  );
}

function respond(
  {
    date,
    itemId,
    recurrenceId,
    scope,
    today,
  }: {
    date: LocalDateString;
    itemId: string | null;
    recurrenceId: string;
    scope: AppScope;
    today: LocalDateString;
  },
  resolveAnswer: (
    measure: RecurrenceMeasure | null,
  ) => ResponseAnswer | null | false,
): Promise<boolean> {
  if (!canRespondOnDate(date, today)) {
    return Promise.resolve(false);
  }

  return db.transaction(
    'rw',
    db.syncOutbox,
    db.recurrences,
    db.recurrenceResponses,
    async () => {
      const recurrence = await getScopedRecurrence(scope, recurrenceId);
      const content = recurrence
        ? await getAnswerableContent({ date, itemId, recurrence, scope })
        : null;

      if (!content) {
        return false;
      }

      const answer = resolveAnswer(getItemMeasure(content, itemId));

      if (answer === false) {
        return false;
      }

      await writeResponse({ answer, date, itemId, recurrenceId, scope });

      return true;
    },
  );
}

export function setRecurrenceResponse({
  status,
  ...target
}: {
  date: LocalDateString;
  itemId: string | null;
  recurrenceId: string;
  scope: AppScope;
  status: RecurrenceResponseStatus | null;
  today: LocalDateString;
}): Promise<boolean> {
  return respond(target, (measure) => {
    if (measure && status !== null) {
      return false;
    }

    return status === null ? null : { quantity: null, status };
  });
}

export function setRecurrenceQuantity({
  value,
  ...target
}: {
  date: LocalDateString;
  itemId: string | null;
  recurrenceId: string;
  scope: AppScope;
  today: LocalDateString;
  value: number | null;
}): Promise<boolean> {
  return respond(target, (measure) => {
    if (value === null) {
      return null;
    }

    if (!measure || !validateQuantityValue(value)) {
      return false;
    }

    const quantity = { ...measure, value };

    return { quantity, status: getQuantityStatus(quantity) };
  });
}
