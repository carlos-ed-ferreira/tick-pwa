import { describe, expect, it } from 'vitest';
import { maskScheduledTimeInput } from '@/components/app/scheduled-time-mask';

describe('maskScheduledTimeInput', () => {
  it('keeps an empty value empty', () => {
    expect(maskScheduledTimeInput('')).toBe('');
  });

  it('keeps a single digit untouched', () => {
    expect(maskScheduledTimeInput('9')).toBe('9');
  });

  it('clamps the hour to the last hour of the day', () => {
    expect(maskScheduledTimeInput('93')).toBe('23');
  });

  it('pads the hour once two digits are typed', () => {
    expect(maskScheduledTimeInput('9h')).toBe('9');
    expect(maskScheduledTimeInput('09')).toBe('09');
  });

  it('separates hour and minute while the minute is incomplete', () => {
    expect(maskScheduledTimeInput('123')).toBe('12:3');
  });

  it('clamps the minute to the last minute of the hour', () => {
    expect(maskScheduledTimeInput('9999')).toBe('23:59');
  });

  it('formats a full time', () => {
    expect(maskScheduledTimeInput('0930')).toBe('09:30');
    expect(maskScheduledTimeInput('09:30')).toBe('09:30');
  });

  it('ignores anything beyond four digits', () => {
    expect(maskScheduledTimeInput('123456')).toBe('12:34');
  });

  it('drops characters that are not digits', () => {
    expect(maskScheduledTimeInput('ab12cd')).toBe('12');
  });
});
