'use client';

import { Languages, MoreHorizontal, Tags } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet, BottomSheetAction, IconButton } from '@/components/ui';
import type { SupportedLocale } from '@/lib/domain';
import { LOCALE_LABELS } from '@/lib/i18n';
import { useAppContext } from '@/providers';

export function AppHeaderOverflowMenu({
  onOpenCategories,
}: {
  onOpenCategories: () => void;
}) {
  const { dictionary, isReady, locale, setLocale } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const nextLocale: SupportedLocale = locale === 'pt-BR' ? 'en' : 'pt-BR';

  return (
    <>
      <span className="hidden touch:inline-flex">
        <IconButton
          aria-label={dictionary.navigation.moreOptions}
          className="rounded-full inset-ring-hairline inset-ring-white/10 bg-white/5 text-[#cbd5e0] hover:bg-white/10 hover:text-[#fff9f2] focus-visible:outline-[#f0c38e]"
          onClick={() => setIsOpen(true)}
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </IconButton>
      </span>
      <BottomSheet
        closeLabel={dictionary.actions.cancel}
        open={isOpen}
        title={dictionary.navigation.moreOptions}
        onClose={() => setIsOpen(false)}
      >
        <BottomSheetAction
          icon={<Tags aria-hidden="true" className="size-4 text-[#f0c38e]" />}
          onSelect={() => {
            setIsOpen(false);
            onOpenCategories();
          }}
        >
          {dictionary.navigation.categories}
        </BottomSheetAction>
        <BottomSheetAction
          disabled={!isReady}
          icon={<Languages aria-hidden="true" className="size-4 opacity-70" />}
          onSelect={() => {
            setLocale(nextLocale);
            setIsOpen(false);
          }}
        >
          {`${dictionary.settings.language}: ${LOCALE_LABELS[locale]}`}
        </BottomSheetAction>
      </BottomSheet>
    </>
  );
}
