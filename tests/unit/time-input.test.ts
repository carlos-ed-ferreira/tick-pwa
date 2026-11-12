import { describe, expect, it } from 'vitest';
import { formatScheduledTime, parseTimeInput, maskTimeInput } from '@/lib/time';

describe('localized scheduled times', () => {
  it('formats American time with noon, midnight and afternoon periods', () => {
    expect(formatScheduledTime('00:05', 'en')).toBe('12:05 AM');
    expect(formatScheduledTime('12:00', 'en')).toBe('12:00 PM');
    expect(formatScheduledTime('14:30', 'en')).toBe('2:30 PM');
    expect(formatScheduledTime('14:30', 'pt-BR')).toBe('14:30');
  });

  it('preserves Portuguese numeric masking and accepts American periods', () => {
    expect(maskTimeInput('2961abc', 'pt-BR')).toBe('23:59');
    expect(maskTimeInput('0930', 'en')).toBe('09:30');
    expect(maskTimeInput('2:30 pm', 'en')).toBe('2:30 PM');
  });

  it('parses American input into canonical 24-hour time', () => {
    expect(parseTimeInput('12:05 AM', 'en')).toBe('00:05');
    expect(parseTimeInput('12:00 pm', 'en')).toBe('12:00');
    expect(parseTimeInput('2:30 PM', 'en')).toBe('14:30');
    expect(parseTimeInput('14:30', 'en')).toBe('14:30');
    expect(parseTimeInput('14:30', 'pt-BR')).toBe('14:30');
    expect(parseTimeInput('13:30 PM', 'en')).toBeNull();
    expect(parseTimeInput('2:60 PM', 'en')).toBeNull();
    expect(parseTimeInput('2:3', 'en')).toBeNull();
  });
});
