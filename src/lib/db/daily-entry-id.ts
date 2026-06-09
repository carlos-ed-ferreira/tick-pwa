import type { AppScope, AppScopeId, LocalDateString } from '@/lib/domain';

export function createDailyEntryId({
  date,
  scope,
}: {
  scope: AppScope;
  date: LocalDateString;
}): string | null {
  if (scope.kind === 'guest') {
    return null;
  }

  return createDeterministicDailyEntryId(scope.id, date);
}

export function createDeterministicDailyEntryId(
  scopeId: AppScopeId,
  date: LocalDateString,
): string {
  return `daily:${scopeId}:${date}`;
}
