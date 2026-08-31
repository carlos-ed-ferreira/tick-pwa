import { spawnSync } from 'node:child_process';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const magic = Buffer.from('TICKBACKUP1');
const command = process.argv[2];
const source = process.argv[3];
const target = process.argv[4];

if (!command || !source || !target) {
  throw new Error(
    'Usage: node scripts/backup-archive.mjs <encrypt|decrypt> <source> <target>',
  );
}

const secret = process.env.TICK_BACKUP_ENCRYPTION_KEY?.trim();

if (!secret || secret.length < 32) {
  throw new Error(
    'TICK_BACKUP_ENCRYPTION_KEY must have at least 32 characters.',
  );
}

const key = createHash('sha256').update(secret).digest();

if (command === 'encrypt') {
  encryptDirectory(path.resolve(source), path.resolve(target));
} else if (command === 'decrypt') {
  decryptArchive(path.resolve(source), path.resolve(target));
} else {
  throw new Error(`Unsupported backup archive command: ${command}`);
}

function run(commandName, args) {
  const result = spawnSync(commandName, args, { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${commandName} failed.`);
  }
}

function encryptDirectory(sourceDirectory, targetFile) {
  for (const fileName of [
    'roles.sql',
    'schema.sql',
    'data.sql',
    'manifest.json',
  ]) {
    if (!existsSync(path.join(sourceDirectory, fileName))) {
      throw new Error(`Backup is missing ${fileName}.`);
    }
  }

  mkdirSync(path.dirname(targetFile), { recursive: true });
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'tick-backup-'));
  const archivePath = path.join(temporaryDirectory, 'backup.tar.gz');

  try {
    run('tar', ['-czf', archivePath, '-C', sourceDirectory, '.']);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(readFileSync(archivePath)),
      cipher.final(),
    ]);
    writeFileSync(
      targetFile,
      Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]),
    );
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function decryptArchive(sourceFile, targetDirectory) {
  const contents = readFileSync(sourceFile);

  if (!contents.subarray(0, magic.length).equals(magic)) {
    throw new Error('Backup archive header is invalid.');
  }

  const ivStart = magic.length;
  const tagStart = ivStart + 12;
  const bodyStart = tagStart + 16;
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    contents.subarray(ivStart, tagStart),
  );
  decipher.setAuthTag(contents.subarray(tagStart, bodyStart));
  const decrypted = Buffer.concat([
    decipher.update(contents.subarray(bodyStart)),
    decipher.final(),
  ]);
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'tick-restore-'));
  const archivePath = path.join(temporaryDirectory, 'backup.tar.gz');

  try {
    mkdirSync(targetDirectory, { recursive: true });
    writeFileSync(archivePath, decrypted);
    run('tar', ['-xzf', archivePath, '-C', targetDirectory]);

    for (const fileName of [
      'roles.sql',
      'schema.sql',
      'data.sql',
      'manifest.json',
    ]) {
      const filePath = path.join(targetDirectory, fileName);

      if (!existsSync(filePath) || statSync(filePath).size === 0) {
        throw new Error(`Restored archive has an invalid ${fileName}.`);
      }
    }
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}
