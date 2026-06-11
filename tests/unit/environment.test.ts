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
});
