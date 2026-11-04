'use client';

import { BR, US } from 'country-flag-icons/react/3x2';
import { Check, ChevronDown } from 'lucide-react';
import { forwardRef, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredMenu } from '@/hooks/use-anchored-menu';
import type { SupportedLocale } from '@/lib/domain';
import {
  LOCALE_LABELS,
  LOCALE_SHORT_LABELS,
  SUPPORTED_LOCALES,
} from '@/lib/i18n';
import { useAppContext } from '@/providers';
import { filledPillControlClassName } from '@/components/ui';

const menuPreferredWidth = 224;
const menuOptionHeight = 40;

function LocaleFlagIcon({ locale }: { locale: SupportedLocale }) {
  const FlagIcon = locale === 'pt-BR' ? BR : US;

  return <FlagIcon aria-hidden="true" className="size-4 shrink-0" />;
}

const LocaleMenu = forwardRef<
  HTMLDivElement,
  {
    currentLocale: SupportedLocale;
    label: string;
    style: CSSProperties;
    onSelect: (locale: SupportedLocale) => void;
  }
>(function LocaleMenu({ currentLocale, label, style, onSelect }, ref) {
  return (
    <div
      ref={ref}
      aria-label={label}
      role="menu"
      className="modal-panel modal-panel--flat fixed z-60 grid gap-1 p-2 text-sm text-[#fff9f2] shadow-[0_24px_70px_rgba(5,8,13,0.44)]"
      style={style}
    >
      {SUPPORTED_LOCALES.map((option) => {
        const isCurrent = option === currentLocale;

        return (
          <button
            key={option}
            type="button"
            role="menuitemradio"
            aria-checked={isCurrent}
            className={`flex min-h-9 items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-[#f0c38e]/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c38e] ${
              isCurrent ? 'bg-[#f0c38e]/10' : ''
            }`}
            onClick={() => onSelect(option)}
          >
            <LocaleFlagIcon locale={option} />
            <span className="flex-1">{LOCALE_LABELS[option]}</span>
            {isCurrent ? (
              <Check
                aria-hidden="true"
                className="size-4 shrink-0 text-[#f0c38e]"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
});

export function LanguageSwitcher() {
  const { dictionary, isReady, locale, setLocale } = useAppContext();
  const label = `${dictionary.settings.language}: ${LOCALE_LABELS[locale]}`;
  const estimateMenuHeight = useCallback(
    () => 16 + SUPPORTED_LOCALES.length * menuOptionHeight,
    [],
  );
  const {
    closeMenu,
    containerRef,
    isOpen,
    menuRef,
    menuStyle,
    openMenu,
    triggerRef,
  } = useAnchoredMenu<HTMLButtonElement>({
    estimateMenuHeight,
    preferredWidth: menuPreferredWidth,
  });

  function selectLocale(nextLocale: SupportedLocale) {
    closeMenu({ restoreFocus: true });

    if (nextLocale !== locale) {
      setLocale(nextLocale);
    }
  }

  return (
    <div ref={containerRef} className="inline-flex shrink-0">
      <button
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={label}
        className={filledPillControlClassName}
        disabled={!isReady}
        type="button"
        onClick={() => (isOpen ? closeMenu() : openMenu())}
      >
        <LocaleFlagIcon locale={locale} />
        <span>{LOCALE_SHORT_LABELS[locale]}</span>
        <ChevronDown
          aria-hidden="true"
          className={`size-3.5 opacity-70 transition ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && menuStyle && typeof document !== 'undefined'
        ? createPortal(
            <LocaleMenu
              ref={menuRef}
              currentLocale={locale}
              label={dictionary.settings.language}
              style={menuStyle}
              onSelect={selectLocale}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
