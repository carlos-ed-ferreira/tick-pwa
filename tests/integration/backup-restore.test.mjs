import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';

it.skipIf(process.env.TICK_TEST_BACKUP_RESTORE !== '1')(
  'restores an encrypted synthetic backup into an isolated Supabase Postgres',
  () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tick-restore-test-'));
    const source = path.join(directory, 'source');
    const archive = path.join(directory, 'backup.enc');
    const env = { ...process.env, TICK_BACKUP_ENCRYPTION_KEY: 'a'.repeat(64) };
    const createdAt = new Date().toISOString();

    try {
      mkdirSync(source);
      const files = {
        'roles.sql': 'SELECT 1;',
        'schema.sql': readFileSync('supabase/schemas/tick.sql', 'utf8'),
        'data.sql': `
COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
00000000-0000-0000-0000-000000000000\t22222222-2222-4222-8222-222222222222\t{}\t2026-11-02 21:05:25+00\t192.0.2.1
\\.
INSERT INTO public.account_access (email) VALUES ('restore@example.test');
COPY storage.buckets (id, name, public, versioning_status, lifecycle_configuration, lifecycle_configuration_generation) FROM stdin;
restore-probe\trestore-probe\tf\tDISABLED\t\\N\t\\N
\\.
COPY storage.objects (id, bucket_id, name, metadata, owner_id, user_metadata, archived_at, is_delete_marker, is_versioned) FROM stdin;
33333333-3333-4333-8333-333333333333\trestore-probe\tprobe.txt\t{"size":1}\t11111111-1111-4111-8111-111111111111\t{}\t\\N\tf\tf
\\.
INSERT INTO auth.users (id, email, is_anonymous) VALUES ('11111111-1111-4111-8111-111111111111', 'restore@example.test', false);
INSERT INTO public.profiles (id, email) VALUES ('11111111-1111-4111-8111-111111111111', 'restore@example.test');
SET request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","email":"restore@example.test"}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'restore-probe' AND name = 'probe.txt' AND metadata ->> 'size' = '1') THEN
    RAISE EXCEPTION 'Storage metadata was not restored correctly';
  END IF;
  IF auth.jwt() ->> 'email' IS DISTINCT FROM 'restore@example.test' THEN
    RAISE EXCEPTION 'JWT claims were not restored correctly';
  END IF;
  IF NOT public.current_user_has_app_access() THEN
    RAISE EXCEPTION 'Account access was not restored correctly';
  END IF;
END $$;
`,
        'manifest.json': JSON.stringify({ version: 1, createdAt }),
      };
      for (const [file, contents] of Object.entries(files)) {
        writeFileSync(path.join(source, file), contents);
      }
      const encrypted = spawnSync(
        process.execPath,
        ['scripts/backup-archive.mjs', 'encrypt', source, archive],
        { encoding: 'utf8', env },
      );
      expect(encrypted.status, encrypted.stderr).toBe(0);

      const restored = spawnSync(
        process.execPath,
        ['scripts/restore-backup.mjs', archive],
        { encoding: 'utf8', env, timeout: 120000 },
      );
      expect(restored.status, restored.stderr || restored.error?.message).toBe(
        0,
      );
      const result = JSON.parse(restored.stdout);
      expect(result.publicTables).toBe(12);
      expect(result.backupCreatedAt).toBe(createdAt);
      expect(result.rtoMs).toBeLessThan(120000);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  },
  130000,
);
