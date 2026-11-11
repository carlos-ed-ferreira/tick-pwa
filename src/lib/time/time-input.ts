import type { SupportedLocale } from '@/lib/domain';

export function formatScheduledTime(
  time: string,
  locale: SupportedLocale,
): string {
  if (locale !== 'en') return time;
  const [hour, minute] = time.split(':');
  const hours = Number(hour);
  return `${hours % 12 || 12}:${minute} ${hours < 12 ? 'AM' : 'PM'}`;
}

export function parseTimeInput(
  value: string,
  locale: SupportedLocale,
): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  const [, hourPart, minute, period] = match;
  let hour = Number(hourPart);
  if (Number(minute) > 59 || hour > 23) return null;
  if (period) {
    if (locale !== 'en' || hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (period.toUpperCase() === 'PM' ? 12 : 0);
  }
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

export function maskTimeInput(value: string, locale: SupportedLocale): string {
  if (locale === 'en') {
    const cleaned = value.replace(/[^0-9: apm]/gi, '').toUpperCase();
    return /^\d{3,4}$/.test(cleaned)
      ? `${cleaned.slice(0, -2)}:${cleaned.slice(-2)}`
      : cleaned;
  }
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length < 2) {
    return digits;
  }

  const hour = Math.min(Number(digits.slice(0, 2)), 23)
    .toString()
    .padStart(2, '0');

  if (digits.length === 2) {
    return hour;
  }

  const minuteDigits = digits.slice(2, 4);
  const minute =
    minuteDigits.length === 2
      ? Math.min(Number(minuteDigits), 59).toString().padStart(2, '0')
      : minuteDigits;

  return `${hour}:${minute}`;
}

export function isTimeInputComplete(
  value: string,
  locale: SupportedLocale,
): boolean {
  if (!value) return true;
  const masked = maskTimeInput(value, locale);
  return (
    parseTimeInput(masked, locale) !== null &&
    (locale !== 'en' || /^[0-9]{4}$/.test(value) || /[AP]M$/i.test(masked))
  );
}
