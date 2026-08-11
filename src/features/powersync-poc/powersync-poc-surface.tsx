'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, FormField, Text } from '@/components/ui';
import { shouldUsePowerSyncPocForUser } from '@/lib/environment';
import { createPowerSyncPocScenario } from '@/lib/powersync/poc-commands';
import type { PowerSyncPocSnapshot } from '@/lib/powersync/store';
import { getTodayKey } from '@/lib/time';
import { useAppContext } from '@/providers';

const emptySnapshot: PowerSyncPocSnapshot = {
  categoryTags: [],
  checklistItems: [],
  dailyEntries: [],
};

export function PowerSyncPocSurface() {
  const { authMode, dictionary, scope, timezonePreference } = useAppContext();
  const [categoryName, setCategoryName] = useState('POWERSYNC');
  const [parentText, setParentText] = useState('Offline task');
  const [childText, setChildText] = useState('Offline subtask');
  const [viewState, setViewState] = useState<{
    scopeId: string | null;
    snapshot: PowerSyncPocSnapshot;
    status: 'loading' | 'ready' | 'error';
  }>({ scopeId: null, snapshot: emptySnapshot, status: 'loading' });
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const isAllowed =
    authMode === 'authenticated' &&
    scope?.kind === 'user' &&
    shouldUsePowerSyncPocForUser(scope.ownerId);
  const isCurrentScope = isAllowed && viewState.scopeId === scope.id;
  const snapshot = isCurrentScope ? viewState.snapshot : emptySnapshot;
  const status = isCurrentScope ? viewState.status : 'loading';

  async function refreshSnapshot() {
    if (!isAllowed || scope?.kind !== 'user') {
      return;
    }

    try {
      const runtime = await import('@/lib/powersync/runtime');
      await runtime.startPowerSyncPoc(scope);
      setViewState({
        scopeId: scope.id,
        snapshot: await runtime.readPowerSyncPocSnapshot(scope),
        status: 'ready',
      });
    } catch {
      setViewState({
        scopeId: scope.id,
        snapshot: emptySnapshot,
        status: 'error',
      });
    }
  }

  useEffect(() => {
    if (!isAllowed || scope?.kind !== 'user') {
      return;
    }

    let isActive = true;

    void import('@/lib/powersync/runtime')
      .then(async (runtime) => {
        await runtime.startPowerSyncPoc(scope);
        return runtime.readPowerSyncPocSnapshot(scope);
      })
      .then((nextSnapshot) => {
        if (isActive) {
          setViewState({
            scopeId: scope.id,
            snapshot: nextSnapshot,
            status: 'ready',
          });
        }
      })
      .catch(() => {
        if (isActive) {
          setViewState({
            scopeId: scope.id,
            snapshot: emptySnapshot,
            status: 'error',
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [isAllowed, scope]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAllowed || scope?.kind !== 'user') {
      return;
    }

    if (!categoryName.trim() || !parentText.trim() || !childText.trim()) {
      setFormError(dictionary.powerSyncPoc.required);
      return;
    }

    setFormError(null);
    setIsCreating(true);

    try {
      const runtime = await import('@/lib/powersync/runtime');
      await runtime.startPowerSyncPoc(scope);
      await createPowerSyncPocScenario({
        categoryName,
        childText,
        date: getTodayKey(timezonePreference.timezone),
        parentText,
        scope,
        timezone: timezonePreference.timezone,
        writeMany: runtime.writePowerSyncPocBatch,
      });
      setViewState({
        scopeId: scope.id,
        snapshot: await runtime.readPowerSyncPocSnapshot(scope),
        status: 'ready',
      });
    } catch {
      setViewState({
        scopeId: scope.id,
        snapshot: emptySnapshot,
        status: 'error',
      });
    } finally {
      setIsCreating(false);
    }
  }

  if (!isAllowed) {
    return (
      <main className="flex min-h-dvh items-center bg-background px-5 py-10 text-foreground">
        <Text className="mx-auto max-w-md" tone="muted">
          {dictionary.powerSyncPoc.unavailable}
        </Text>
      </main>
    );
  }

  const activeItems = snapshot.checklistItems.filter(
    (item) => item.deletedAt === null,
  );
  const rootItems = activeItems.filter((item) => item.parentId === null);

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        <header>
          <Text tone="muted" weight="medium">
            POC
          </Text>
          <h1 className="mt-2 text-2xl font-semibold">
            {dictionary.powerSyncPoc.title}
          </h1>
          <Text className="mt-2" leading="relaxed" tone="muted">
            {dictionary.powerSyncPoc.description}
          </Text>
        </header>

        <section className="card-surface p-4 sm:p-5">
          <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
            <FormField
              label={dictionary.powerSyncPoc.categoryLabel}
              onChange={(event) => setCategoryName(event.target.value)}
              value={categoryName}
            />
            <FormField
              label={dictionary.powerSyncPoc.parentLabel}
              onChange={(event) => setParentText(event.target.value)}
              value={parentText}
            />
            <FormField
              error={formError}
              label={dictionary.powerSyncPoc.childLabel}
              onChange={(event) => setChildText(event.target.value)}
              value={childText}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                disabled={isCreating || status === 'loading'}
                type="submit"
              >
                {isCreating
                  ? dictionary.powerSyncPoc.creating
                  : dictionary.powerSyncPoc.createScenario}
              </Button>
              <Button
                disabled={isCreating}
                onClick={() => void refreshSnapshot()}
                tone="subtle"
              >
                {dictionary.powerSyncPoc.refresh}
              </Button>
            </div>
          </form>
        </section>

        <Text role="status" tone={status === 'error' ? 'danger' : 'muted'}>
          {status === 'error'
            ? dictionary.powerSyncPoc.error
            : status === 'loading'
              ? dictionary.auth.loading
              : dictionary.powerSyncPoc.ready}
        </Text>
        <Text leading="relaxed" tone="muted">
          {dictionary.powerSyncPoc.localNotice}
        </Text>

        {snapshot.categoryTags.length === 0 && activeItems.length === 0 ? (
          <Text tone="muted">{dictionary.powerSyncPoc.empty}</Text>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <section>
              <h2 className="text-lg font-semibold">
                {dictionary.powerSyncPoc.categories}
              </h2>
              <ul className="mt-3 grid gap-2">
                {snapshot.categoryTags.map((category) => (
                  <li
                    key={category.id}
                    className="rounded-xl bg-surface px-4 py-3"
                  >
                    {category.name}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold">
                {dictionary.powerSyncPoc.hierarchy}
              </h2>
              <ul className="mt-3 grid gap-3">
                {rootItems.map((item) => (
                  <li key={item.id} className="rounded-xl bg-surface px-4 py-3">
                    <span>{item.text}</span>
                    <ul className="mt-2 grid gap-2 pl-5 text-sm text-muted">
                      {activeItems
                        .filter((child) => child.parentId === item.id)
                        .map((child) => (
                          <li key={child.id}>{child.text}</li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
