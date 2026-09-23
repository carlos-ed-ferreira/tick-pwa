export function maskScheduledTimeInput(value: string): string {
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
