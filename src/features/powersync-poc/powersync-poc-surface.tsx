'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, ConfirmationDialog, FormField, Text } from '@/components/ui';
import { sortByRank, type ChecklistItem } from '@/lib/domain';
import { shouldUsePowerSyncPocForUser } from '@/lib/environment';
import { formatCountLabel } from '@/lib/i18n';
import {
  createPowerSyncPocScenario,
  mutatePowerSyncPocChecklistItem,
} from '@/lib/powersync/poc-commands';
import type { PowerSyncPocStatus } from '@/lib/powersync/runtime';
import type { PowerSyncPocSnapshot } from '@/lib/powersync/store';
import { getTodayKey } from '@/lib/time';
import { useAppContext } from '@/providers';

const emptySnapshot: PowerSyncPocSnapshot = {
  categoryTags: [],
  checklistItems: [],
  dailyEntries: [],
};

type ViewState = {
  scopeId: string | null;
  snapshot: PowerSyncPocSnapshot;
  status: 'loading' | 'ready' | 'error';
  syncStatus: PowerSyncPocStatus | null;
};

export function PowerSyncPocSurface() {
  const { authMode, dictionary, scope, timezonePreference } = useAppContext();
  const [categoryName, setCategoryName] = useState('POWERSYNC');
  const [parentText, setParentText] = useState('Offline task');
  const [childText, setChildText] = useState('Offline subtask');
  const [siblingText, setSiblingText] = useState('Offline sibling');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [viewState, setViewState] = useState<ViewState>({
    scopeId: null,
    snapshot: emptySnapshot,
    status: 'loading',
    syncStatus: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const isAllowed =
    authMode === 'authenticated' &&
    scope?.kind === 'user' &&
    shouldUsePowerSyncPocForUser(scope.ownerId);
  const isCurrentScope = isAllowed && viewState.scopeId === scope.id;
  const snapshot = isCurrentScope ? viewState.snapshot : emptySnapshot;
  const status = isCurrentScope ? viewState.status : 'loading';
  const syncStatus = isCurrentScope ? viewState.syncStatus : null;

  const readCurrentState = useCallback(async () => {
    if (!isAllowed || scope?.kind !== 'user') {
      return null;
    }

    const runtime = await import('@/lib/powersync/runtime');
    await runtime.startPowerSyncPoc(scope);
    const [nextSnapshot, nextSyncStatus] = await Promise.all([
      runtime.readPowerSyncPocSnapshot(scope),
      runtime.readPowerSyncPocStatus(scope),
    ]);

    return {
      scopeId: scope.id,
      snapshot: nextSnapshot,
      status: 'ready' as const,
      syncStatus: nextSyncStatus,
    };
  }, [isAllowed, scope]);

  const refreshSyncStatus = useCallback(async () => {
    if (!isAllowed || scope?.kind !== 'user') {
      return;
    }

    const runtime = await import('@/lib/powersync/runtime');
    const nextSyncStatus = await runtime.readPowerSyncPocStatus(scope);

    setViewState((current) =>
      current.scopeId === scope.id
        ? { ...current, status: 'ready', syncStatus: nextSyncStatus }
        : current,
    );
  }, [isAllowed, scope]);

  async function refreshSnapshot() {
    try {
      const nextState = await readCurrentState();

      if (nextState) {
        setViewState(nextState);
      }
    } catch {
      if (scope) {
        setViewState({
          scopeId: scope.id,
          snapshot: emptySnapshot,
          status: 'error',
          syncStatus: null,
        });
      }
    }
  }

  useEffect(() => {
    if (!isAllowed || scope?.kind !== 'user') {
      return;
    }

    let isActive = true;

    void readCurrentState()
      .then((nextState) => {
        if (isActive && nextState) {
          setViewState(nextState);
        }
      })
      .catch(() => {
        if (isActive) {
          setViewState({
            scopeId: scope.id,
            snapshot: emptySnapshot,
            status: 'error',
            syncStatus: null,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [isAllowed, readCurrentState, scope]);

  useEffect(() => {
    if (!isAllowed || scope?.kind !== 'user' || !isCurrentScope) {
      return;
    }

    let isRefreshing = false;
    const interval = window.setInterval(() => {
      if (isRefreshing) {
        return;
      }

      isRefreshing = true;
      void refreshSyncStatus()
        .catch(() => {
          setViewState((current) =>
            current.scopeId === scope.id
              ? { ...current, status: 'error' }
              : current,
          );
        })
        .finally(() => {
          isRefreshing = false;
        });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isAllowed, isCurrentScope, refreshSyncStatus, scope]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAllowed || scope?.kind !== 'user') {
      return;
    }

    if (
      !categoryName.trim() ||
      !parentText.trim() ||
      !childText.trim() ||
      !siblingText.trim()
    ) {
      setFormError(dictionary.powerSyncPoc.required);
      return;
    }

    setFormError(null);
    setMutationError(null);
    setIsCreating(true);

    try {
      const runtime = await import('@/lib/powersync/runtime');
      await runtime.startPowerSyncPoc(scope);
      await createPowerSyncPocScenario({
        categoryName,
        childText,
        date: getTodayKey(timezonePreference.timezone),
        parentText,
        siblingText,
        scope,
        timezone: timezonePreference.timezone,
        writeMany: runtime.writePowerSyncPocBatch,
      });
      await refreshSnapshot();
    } catch {
      setMutationError(dictionary.powerSyncPoc.mutationError);
    } finally {
      setIsCreating(false);
    }
  }

  async function mutateItem(
    item: ChecklistItem,
    action:
      | { text: string; type: 'update' }
      | { type: 'toggleChecked' }
      | { type: 'moveDown' }
      | { type: 'delete' },
  ) {
    if (!isAllowed || scope?.kind !== 'user') {
      return;
    }

    setMutationError(null);
    setPendingItemId(item.id);

    try {
      const runtime = await import('@/lib/powersync/runtime');
      await mutatePowerSyncPocChecklistItem({
        action,
        itemId: item.id,
        scope,
        snapshot,
        writeMany: runtime.writePowerSyncPocBatch,
      });
      await refreshSnapshot();
    } catch {
      setMutationError(dictionary.powerSyncPoc.mutationError);
    } finally {
      setPendingItemId(null);
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
  const rootItems = sortByRank(
    activeItems.filter((item) => item.parentId === null),
  );
  const syncLabel = syncStatus?.hasError
    ? dictionary.powerSyncPoc.error
    : syncStatus && syncStatus.pendingOperations > 0
      ? formatCountLabel({
          count: syncStatus.pendingOperations,
          plural: dictionary.powerSyncPoc.pendingOperations,
          singular: dictionary.powerSyncPoc.pendingOperation,
        })
      : syncStatus?.uploading || syncStatus?.downloading
        ? dictionary.sync.syncing
        : syncStatus?.connecting
          ? dictionary.powerSyncPoc.connecting
          : syncStatus?.connected && syncStatus.hasSynced
            ? dictionary.powerSyncPoc.synchronized
            : syncStatus?.connected
              ? dictionary.powerSyncPoc.connected
              : dictionary.powerSyncPoc.offline;

  function renderItem(item: ChecklistItem, canMoveDown: boolean) {
    const draft = drafts[item.id] ?? item.text;
    const isPending = pendingItemId !== null;
    const actionLabel = (action: string) =>
      dictionary.powerSyncPoc.itemAction
        .replace('{action}', action)
        .replace('{item}', item.text);

    return (
      <div className="grid gap-3">
        <FormField
          disabled={isPending}
          label={dictionary.powerSyncPoc.itemLabel}
          onChange={(event) =>
            setDrafts((current) => ({
              ...current,
              [item.id]: event.target.value,
            }))
          }
          value={draft}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            aria-label={actionLabel(dictionary.powerSyncPoc.saveItem)}
            disabled={isPending || !draft.trim() || draft === item.text}
            onClick={() =>
              void mutateItem(item, { text: draft, type: 'update' })
            }
            tone="subtle"
          >
            {dictionary.powerSyncPoc.saveItem}
          </Button>
          <Button
            aria-label={actionLabel(
              item.checked
                ? dictionary.powerSyncPoc.reopenItem
                : dictionary.powerSyncPoc.markComplete,
            )}
            disabled={isPending}
            onClick={() => void mutateItem(item, { type: 'toggleChecked' })}
            tone="subtle"
          >
            {item.checked
              ? dictionary.powerSyncPoc.reopenItem
              : dictionary.powerSyncPoc.markComplete}
          </Button>
          <Button
            aria-label={actionLabel(dictionary.powerSyncPoc.moveDown)}
            disabled={isPending || !canMoveDown}
            onClick={() => void mutateItem(item, { type: 'moveDown' })}
            tone="subtle"
          >
            {dictionary.powerSyncPoc.moveDown}
          </Button>
          <Button
            aria-label={actionLabel(dictionary.powerSyncPoc.deleteItem)}
            disabled={isPending}
            onClick={() => setDeleteTarget(item)}
            tone="danger"
          >
            {dictionary.powerSyncPoc.deleteItem}
          </Button>
        </div>
      </div>
    );
  }

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
              label={dictionary.powerSyncPoc.childLabel}
              onChange={(event) => setChildText(event.target.value)}
              value={childText}
            />
            <FormField
              error={formError}
              label={dictionary.powerSyncPoc.siblingLabel}
              onChange={(event) => setSiblingText(event.target.value)}
              value={siblingText}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                disabled={
                  isCreating || pendingItemId !== null || status === 'loading'
                }
                type="submit"
              >
                {isCreating
                  ? dictionary.powerSyncPoc.creating
                  : dictionary.powerSyncPoc.createScenario}
              </Button>
              <Button
                disabled={isCreating || pendingItemId !== null}
                onClick={() => void refreshSnapshot()}
                tone="subtle"
              >
                {dictionary.powerSyncPoc.refresh}
              </Button>
            </div>
          </form>
        </section>

        <div aria-live="polite" className="grid gap-1">
          <Text role="status" tone={status === 'error' ? 'danger' : 'muted'}>
            {status === 'error'
              ? dictionary.powerSyncPoc.error
              : status === 'loading'
                ? dictionary.auth.loading
                : dictionary.powerSyncPoc.ready}
          </Text>
          {status === 'ready' ? <Text tone="muted">{syncLabel}</Text> : null}
          {mutationError ? <Text tone="danger">{mutationError}</Text> : null}
        </div>
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
                {rootItems.map((item, rootIndex) => {
                  const children = sortByRank(
                    activeItems.filter((child) => child.parentId === item.id),
                  );

                  return (
                    <li
                      key={item.id}
                      className="grid gap-4 rounded-xl bg-surface px-4 py-3"
                    >
                      {renderItem(item, rootIndex < rootItems.length - 1)}
                      <ul className="grid gap-4 pl-4 text-sm text-muted">
                        {children.map((child, childIndex) => (
                          <li key={child.id}>
                            {renderItem(
                              child,
                              childIndex < children.length - 1,
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}
      </div>
      <ConfirmationDialog
        cancelLabel={dictionary.actions.cancel}
        confirmLabel={dictionary.actions.delete}
        description={dictionary.powerSyncPoc.confirmDelete}
        open={deleteTarget !== null}
        title={dictionary.powerSyncPoc.deleteTitle}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          const item = deleteTarget;
          setDeleteTarget(null);

          if (item) {
            void mutateItem(item, { type: 'delete' });
          }
        }}
      />
    </main>
  );
}
