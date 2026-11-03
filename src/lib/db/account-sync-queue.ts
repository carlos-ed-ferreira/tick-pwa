const tasks = new Map<string, Promise<void>>();

export async function withAccountSyncLock(
  scopeId: string,
  task: () => Promise<void>,
): Promise<void> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (locks) await locks.request(`tick-account-outbox:${scopeId}`, task);
  else await task();
}

export function enqueueAccountSyncTask(
  scopeId: string,
  task: () => Promise<void>,
): Promise<void> {
  const previous = tasks.get(scopeId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(task)
    .finally(() => {
      if (tasks.get(scopeId) === next) tasks.delete(scopeId);
    });
  tasks.set(scopeId, next);
  return next;
}

export async function waitForAccountSyncTasks(scopeId?: string): Promise<void> {
  while (scopeId ? tasks.has(scopeId) : tasks.size > 0) {
    await Promise.all(scopeId ? [tasks.get(scopeId)] : [...tasks.values()]);
  }
}
