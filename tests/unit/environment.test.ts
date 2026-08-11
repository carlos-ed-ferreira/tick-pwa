import { describe, expect, it } from 'vitest';
import {
  isLocalhostHostname,
  isPowerSyncPocUserAllowed,
  shouldForceLocalOnlyMode,
  shouldUsePowerSyncPocOnHostname,
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
        supabaseEnvironment: 'production',
        supabaseUrl: 'https://prod.supabase.co',
      }),
    ).toBe(true);

    expect(
      shouldForceLocalOnlyMode({
        hostname: 'localhost',
        disableSupabase: false,
        supabaseEnvironment: 'local',
        supabaseUrl: 'http://127.0.0.1:54321',
      }),
    ).toBe(false);

    expect(
      shouldForceLocalOnlyMode({
        hostname: 'tick.example.com',
        disableSupabase: false,
        supabaseEnvironment: 'production',
        supabaseUrl: 'https://prod.supabase.co',
      }),
    ).toBe(false);

    expect(
      shouldForceLocalOnlyMode({
        hostname: 'tick.example.com',
        disableSupabase: true,
        supabaseEnvironment: 'production',
        supabaseUrl: 'https://prod.supabase.co',
      }),
    ).toBe(true);
  });

  it('uses cloud sync on localhost only for a local Supabase URL', () => {
    expect(
      shouldUseCloudSyncOnHostname({
        hostname: 'localhost',
        disableSupabase: false,
        supabaseEnvironment: 'local',
        supabaseUrl: 'http://127.0.0.1:54321',
      }),
    ).toBe(true);

    expect(
      shouldUseCloudSyncOnHostname({
        hostname: 'localhost',
        disableSupabase: false,
        supabaseEnvironment: 'production',
        supabaseUrl: 'https://prod.supabase.co',
      }),
    ).toBe(false);

    expect(
      shouldUseCloudSyncOnHostname({
        hostname: 'localhost',
        disableSupabase: false,
        supabaseEnvironment: 'local',
        supabaseUrl: 'https://prod.supabase.co',
      }),
    ).toBe(false);

    expect(
      shouldUseCloudSyncOnHostname({
        hostname: 'tick.example.com',
        disableSupabase: false,
        supabaseEnvironment: 'production',
        supabaseUrl: 'https://prod.supabase.co',
      }),
    ).toBe(true);

    expect(
      shouldUseCloudSyncOnHostname({
        hostname: 'tick.example.com',
        disableSupabase: true,
        supabaseEnvironment: 'production',
        supabaseUrl: 'https://prod.supabase.co',
      }),
    ).toBe(false);

    expect(
      shouldUseCloudSyncOnHostname({
        hostname: 'tick.example.com',
        disableSupabase: false,
        supabaseEnvironment: undefined,
        supabaseUrl: 'https://prod.supabase.co',
      }),
    ).toBe(false);

    expect(
      shouldUseCloudSyncOnHostname({
        hostname: 'tick.example.com',
        disableSupabase: false,
        supabaseEnvironment: 'staging',
        supabaseUrl: 'https://prod.supabase.co',
      }),
    ).toBe(false);
  });

  it('enables the PowerSync proof only with cloud sync, an explicit flag and HTTPS', () => {
    const enabledConfiguration = {
      hostname: 'tickapp.com.br',
      disableSupabase: false,
      enablePowerSyncPoc: true,
      powerSyncUrl: 'https://example.powersync.journeyapps.com',
      supabaseEnvironment: 'production',
      supabaseUrl: 'https://project.supabase.co',
    };

    expect(shouldUsePowerSyncPocOnHostname(enabledConfiguration)).toBe(true);
    expect(
      shouldUsePowerSyncPocOnHostname({
        ...enabledConfiguration,
        enablePowerSyncPoc: false,
      }),
    ).toBe(false);
    expect(
      shouldUsePowerSyncPocOnHostname({
        ...enabledConfiguration,
        disableSupabase: true,
      }),
    ).toBe(false);
    expect(
      shouldUsePowerSyncPocOnHostname({
        ...enabledConfiguration,
        powerSyncUrl: 'http://example.powersync.journeyapps.com',
      }),
    ).toBe(false);
  });

  it('restricts the PowerSync proof to explicitly listed account ids', () => {
    expect(
      isPowerSyncPocUserAllowed(
        'allowed-user',
        'first-user, allowed-user ,third-user',
      ),
    ).toBe(true);
    expect(
      isPowerSyncPocUserAllowed('another-user', 'first-user,allowed-user'),
    ).toBe(false);
    expect(isPowerSyncPocUserAllowed('allowed-user', '')).toBe(false);
    expect(isPowerSyncPocUserAllowed(null, 'allowed-user')).toBe(false);
  });
});
