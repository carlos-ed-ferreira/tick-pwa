import { describe, expect, it } from 'vitest';
import {
  isLocalhostHostname,
  shouldForceLocalOnlyMode,
  shouldUseCloudSyncOnHostname,
} from '@/lib/environment';

describe('environment helpers', () => {
  it('recognizes local hostnames', () => {
    expect(isLocalhostHostname('localhost')).toBe(true);
    expect(isLocalhostHostname('127.0.0.1')).toBe(true);
    expect(isLocalhostHostname('::1')).toBe(true);
    expect(isLocalhostHostname('tick.example.com')).toBe(false);
  });

  it('forces local-only mode on localhost unless explicitly overridden', () => {
    expect(
      shouldForceLocalOnlyMode({
        hostname: 'localhost',
        disableSupabase: false,
        allowSupabaseOnLocalhost: false,
      }),
    ).toBe(true);

    expect(
      shouldForceLocalOnlyMode({
        hostname: 'localhost',
        disableSupabase: false,
        allowSupabaseOnLocalhost: true,
      }),
    ).toBe(false);

    expect(
      shouldForceLocalOnlyMode({
        hostname: 'tick.example.com',
        disableSupabase: false,
        allowSupabaseOnLocalhost: false,
      }),
    ).toBe(false);

    expect(
      shouldForceLocalOnlyMode({
        hostname: 'tick.example.com',
        disableSupabase: true,
        allowSupabaseOnLocalhost: true,
      }),
    ).toBe(true);
  });

  it('isolates cloud sync on localhost by default while allowing an explicit override', () => {
    expect(
      shouldUseCloudSyncOnHostname({
        hostname: 'localhost',
        disableSupabase: false,
        allowSupabaseOnLocalhost: false,
      }),
    ).toBe(false);

    expect(
      shouldUseCloudSyncOnHostname({
        hostname: 'localhost',
        disableSupabase: false,
        allowSupabaseOnLocalhost: true,
      }),
    ).toBe(true);

    expect(
      shouldUseCloudSyncOnHostname({
        hostname: 'tick.example.com',
        disableSupabase: false,
        allowSupabaseOnLocalhost: false,
      }),
    ).toBe(true);
  });
});
