import type {
  LocalePreference,
  SupportedLocale,
  TimezoneDetectionSource,
} from '@/lib/domain';

export const BRAZIL_TIMEZONE = 'America/Sao_Paulo';
export const BRAZIL_TIMEZONE_OFFSET = '-03:00';
export const UTC_TIMEZONE = 'UTC';

export function getBrowserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function getTimezoneOffset(timezone: string, date = new Date()): string {
  if (timezone === BRAZIL_TIMEZONE) {
    return BRAZIL_TIMEZONE_OFFSET;
  }

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(date);
    const timezoneName = parts.find(
      (part) => part.type === 'timeZoneName',
    )?.value;

    if (!timezoneName || timezoneName === 'GMT') {
      return '+00:00';
    }

    const match = timezoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);

    if (!match) {
      return '+00:00';
    }

    const [, sign, hours, minutes = '00'] = match;
    return `${sign}${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  } catch {
    return timezone === UTC_TIMEZONE ? '+00:00' : BRAZIL_TIMEZONE_OFFSET;
  }
}

export function resolveTimezonePreference(
  locale: SupportedLocale,
  detectedFrom: TimezoneDetectionSource = 'browser',
): LocalePreference {
  const browserTimezone = getBrowserTimezone();
  const timezone =
    locale === 'pt-BR' ? BRAZIL_TIMEZONE : (browserTimezone ?? UTC_TIMEZONE);
  const source = browserTimezone ? detectedFrom : 'fallback';

  return {
    locale,
    timezone,
    timezoneOffset: getTimezoneOffset(timezone),
    detectedFrom: locale === 'pt-BR' ? 'region' : source,
    updatedAt: new Date().toISOString(),
  };
}
