import type {
  AppScope,
  CategoryTag,
  CategoryTagSurface,
  SupportedLocale,
} from '@/lib/domain';
import {
  compareSortRanks,
  createId,
  createSortRankBetween,
} from '@/lib/domain';
import {
  getDefaultCategoryTagTemplates,
  getRemovedDefaultCategoryTagTemplates,
  SUPPORTED_LOCALES,
  type AnyDefaultCategoryKey,
  type DefaultCategoryKey,
  type RemovedDefaultCategoryKey,
} from '@/lib/i18n';
import { db } from './database';
import { createSyncMetadata, createTimestamp } from './entity-metadata';

const DEFAULT_CATEGORY_SEED_STATE_PREFERENCE_KEY = 'defaultCategorySeedState';
const removedDefaultCategoryKeys = ['people'] as const;

interface DefaultCategorySeedState {
  initialized: boolean;
  locale: SupportedLocale;
  categoryIdsByKey: Partial<Record<AnyDefaultCategoryKey, string>>;
}

function normalizeCategoryTagName(name: string): string {
  return name.normalize('NFC').trim().toLocaleUpperCase();
}

function defaultCategorySeedStateKey(
  scope: AppScope,
  surface: CategoryTagSurface,
): string {
  return `${scope.id}:${surface}:${DEFAULT_CATEGORY_SEED_STATE_PREFERENCE_KEY}`;
}

async function readDefaultCategorySeedState(
  scope: AppScope,
  surface: CategoryTagSurface,
): Promise<DefaultCategorySeedState | null> {
  const preference = await db.localPreferences.get(
    defaultCategorySeedStateKey(scope, surface),
  );
  const value = preference?.value;

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    initialized: record.initialized === true,
    locale: (record.locale as SupportedLocale | undefined) ?? 'en',
    categoryIdsByKey:
      (record.categoryIdsByKey as DefaultCategorySeedState['categoryIdsByKey']) ??
      {},
  };
}

async function writeDefaultCategorySeedState(
  scope: AppScope,
  surface: CategoryTagSurface,
  state: DefaultCategorySeedState,
): Promise<void> {
  await db.localPreferences.put({
    key: defaultCategorySeedStateKey(scope, surface),
    scopeId: scope.id,
    value: state,
    updatedAt: createTimestamp(),
  });
}

function sortCategoryTags(tags: CategoryTag[]): CategoryTag[] {
  return [...tags].sort((firstTag, secondTag) =>
    compareSortRanks(firstTag.position, secondTag.position),
  );
}

function createDefaultCategoryTag(
  scope: AppScope,
  surface: CategoryTagSurface,
  tag: { name: string; colorHex: string },
  position: string,
): CategoryTag {
  const now = createTimestamp();

  return {
    id: createId(),
    scopeId: scope.id,
    surface,
    name: tag.name,
    colorHex: tag.colorHex,
    position,
    useOwnName: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...createSyncMetadata(scope, now),
  };
}

function createKnownDefaultNamesByKey(): Record<
  DefaultCategoryKey,
  Set<string>
> {
  const namesByKey: Record<DefaultCategoryKey, Set<string>> = {
    focus: new Set<string>(),
    health: new Set<string>(),
    home: new Set<string>(),
  };

  for (const locale of SUPPORTED_LOCALES) {
    for (const template of getDefaultCategoryTagTemplates(locale)) {
      namesByKey[template.key].add(normalizeCategoryTagName(template.name));
    }
  }

  return namesByKey;
}

const knownDefaultNamesByKey = createKnownDefaultNamesByKey();

function createKnownRemovedDefaultNamesByKey(): Record<
  RemovedDefaultCategoryKey,
  Set<string>
> {
  const namesByKey: Record<RemovedDefaultCategoryKey, Set<string>> = {
    people: new Set<string>(),
  };

  for (const locale of SUPPORTED_LOCALES) {
    for (const template of getRemovedDefaultCategoryTagTemplates(locale)) {
      namesByKey[template.key].add(normalizeCategoryTagName(template.name));
    }
  }

  return namesByKey;
}

const knownRemovedDefaultNamesByKey = createKnownRemovedDefaultNamesByKey();

function isRemovedDefaultCategoryKey(
  key: AnyDefaultCategoryKey,
): key is RemovedDefaultCategoryKey {
  return (removedDefaultCategoryKeys as readonly string[]).includes(key);
}

function touchGuestCategoryTagDeleted(
  scope: AppScope,
  categoryTag: CategoryTag,
): CategoryTag {
  const now = createTimestamp();

  return {
    ...categoryTag,
    deletedAt: now,
    updatedAt: now,
    syncStatus: scope.kind === 'guest' ? 'local' : categoryTag.syncStatus,
    clientUpdatedAt: now,
  };
}

function backfillDefaultCategorySeedState({
  activeCategoryTags,
  locale,
}: {
  activeCategoryTags: CategoryTag[];
  locale: SupportedLocale;
}): DefaultCategorySeedState {
  const categoryIdsByKey: DefaultCategorySeedState['categoryIdsByKey'] = {};
  const legacyTemplates = [
    ...getDefaultCategoryTagTemplates('en'),
    ...getRemovedDefaultCategoryTagTemplates('en'),
  ];

  for (const categoryTag of sortCategoryTags(activeCategoryTags)) {
    const normalizedName = normalizeCategoryTagName(categoryTag.name);

    for (const template of legacyTemplates) {
      if (categoryIdsByKey[template.key]) {
        continue;
      }

      const knownNames = isRemovedDefaultCategoryKey(template.key)
        ? knownRemovedDefaultNamesByKey[template.key]
        : knownDefaultNamesByKey[template.key];

      if (
        categoryTag.colorHex.toLowerCase() ===
          template.colorHex.toLowerCase() &&
        knownNames.has(normalizedName)
      ) {
        categoryIdsByKey[template.key] = categoryTag.id;
      }
    }
  }

  return {
    initialized: true,
    locale,
    categoryIdsByKey,
  };
}

function touchGuestCategoryTagName(
  scope: AppScope,
  categoryTag: CategoryTag,
  name: string,
): CategoryTag {
  const now = createTimestamp();

  return {
    ...categoryTag,
    name,
    updatedAt: now,
    syncStatus: scope.kind === 'guest' ? 'local' : categoryTag.syncStatus,
    clientUpdatedAt: now,
  };
}

export async function clearGuestDefaultCategoryTagTracking(
  scope: AppScope,
  categoryTagId: string,
  surface: CategoryTagSurface,
): Promise<void> {
  if (scope.kind !== 'guest') {
    return;
  }

  const state = await readDefaultCategorySeedState(scope, surface);

  if (!state) {
    return;
  }

  let changed = false;
  const categoryIdsByKey: DefaultCategorySeedState['categoryIdsByKey'] = {};

  for (const [key, trackedCategoryTagId] of Object.entries(
    state.categoryIdsByKey,
  ) as Array<[DefaultCategoryKey, string | undefined]>) {
    if (!trackedCategoryTagId || trackedCategoryTagId === categoryTagId) {
      changed ||= trackedCategoryTagId === categoryTagId;
      continue;
    }

    categoryIdsByKey[key] = trackedCategoryTagId;
  }

  if (!changed) {
    return;
  }

  await writeDefaultCategorySeedState(scope, surface, {
    ...state,
    categoryIdsByKey,
  });
}

export async function seedDefaultCategoryTags(
  scope: AppScope,
  locale: SupportedLocale,
  surface: CategoryTagSurface,
): Promise<void> {
  if (scope.kind !== 'guest') {
    return;
  }

  await db.transaction('rw', db.categoryTags, db.localPreferences, async () => {
    const activeCategoryTags = sortCategoryTags(
      await db.categoryTags
        .where('[scopeId+surface]')
        .equals([scope.id, surface])
        .filter((tag) => tag.deletedAt === null)
        .toArray(),
    );
    let state = await readDefaultCategorySeedState(scope, surface);

    if (!state) {
      if (activeCategoryTags.length === 0) {
        let previousPosition: string | null = null;
        const categoryIdsByKey: DefaultCategorySeedState['categoryIdsByKey'] =
          {};
        const tags = getDefaultCategoryTagTemplates(locale).map((template) => {
          const position = createSortRankBetween(previousPosition, null);
          previousPosition = position;
          const categoryTag = createDefaultCategoryTag(
            scope,
            surface,
            template,
            position,
          );
          categoryIdsByKey[template.key] = categoryTag.id;
          return categoryTag;
        });

        await db.categoryTags.bulkAdd(tags);
        await writeDefaultCategorySeedState(scope, surface, {
          initialized: true,
          locale,
          categoryIdsByKey,
        });
        return;
      }

      state = backfillDefaultCategorySeedState({
        activeCategoryTags,
        locale,
      });
    }

    const templatesByKey = new Map(
      getDefaultCategoryTagTemplates(locale).map((template) => [
        template.key,
        template,
      ]),
    );
    const removedTemplatesByKey = new Map(
      getRemovedDefaultCategoryTagTemplates(locale).map((template) => [
        template.key,
        template,
      ]),
    );
    const activeCategoryTagsById = new Map(
      activeCategoryTags.map((tag) => [tag.id, tag]),
    );
    const categoryIdsByKey: DefaultCategorySeedState['categoryIdsByKey'] = {};

    for (const [key, trackedCategoryTagId] of Object.entries(
      state.categoryIdsByKey,
    ) as Array<[AnyDefaultCategoryKey, string | undefined]>) {
      if (!trackedCategoryTagId) {
        continue;
      }

      const categoryTag = activeCategoryTagsById.get(trackedCategoryTagId);

      if (!categoryTag) {
        continue;
      }

      const normalizedName = normalizeCategoryTagName(categoryTag.name);

      if (isRemovedDefaultCategoryKey(key)) {
        const removedTemplate = removedTemplatesByKey.get(key);

        if (
          removedTemplate &&
          categoryTag.colorHex.toLowerCase() ===
            removedTemplate.colorHex.toLowerCase() &&
          knownRemovedDefaultNamesByKey[key].has(normalizedName)
        ) {
          await db.categoryTags.put(
            touchGuestCategoryTagDeleted(scope, categoryTag),
          );
        }

        continue;
      }

      if (!knownDefaultNamesByKey[key].has(normalizedName)) {
        continue;
      }

      categoryIdsByKey[key] = categoryTag.id;

      const template = templatesByKey.get(key);

      if (
        template &&
        normalizedName !== normalizeCategoryTagName(template.name)
      ) {
        await db.categoryTags.put(
          touchGuestCategoryTagName(scope, categoryTag, template.name),
        );
      }
    }

    await writeDefaultCategorySeedState(scope, surface, {
      initialized: true,
      locale,
      categoryIdsByKey,
    });
  });
}
