'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { AppScope, CategoryTag } from '@/lib/domain';
import { compareSortRanks } from '@/lib/domain';
import { db } from '@/lib/db';

export function useCategoryTags(scope: AppScope | null): CategoryTag[] {
  return (
    useLiveQuery(
      async () => {
        if (!scope) {
          return [];
        }

        const categoryTags = await db.categoryTags
          .where('scopeId')
          .equals(scope.id)
          .filter((tag) => tag.deletedAt === null)
          .toArray();

        return categoryTags.sort((firstTag, secondTag) =>
          compareSortRanks(firstTag.position, secondTag.position),
        );
      },
      [scope?.id],
      [],
    ) ?? []
  );
}
