'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { AppScope, ColorTag } from '@/lib/domain';
import { compareSortRanks } from '@/lib/domain';
import { db } from '@/lib/db';

export function useColorTags(scope: AppScope | null): ColorTag[] {
  return (
    useLiveQuery(
      async () => {
        if (!scope) {
          return [];
        }

        const colorTags = await db.colorTags
          .where('scopeId')
          .equals(scope.id)
          .filter((tag) => tag.deletedAt === null)
          .toArray();

        return colorTags.sort((firstTag, secondTag) =>
          compareSortRanks(firstTag.position, secondTag.position),
        );
      },
      [scope?.id],
      [],
    ) ?? []
  );
}
