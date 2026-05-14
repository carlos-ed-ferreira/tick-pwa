import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const workspaceRoot = process.cwd();
const envFilePath = path.resolve(
  workspaceRoot,
  process.env.SUPABASE_ENV_FILE ?? '.env.local',
);

loadEnvFile(envFilePath);

const command = process.argv[2];

if (!command) {
  printUsage();
  process.exit(1);
}

const extraArgs = process.argv.slice(3);

try {
  if (command === 'link') {
    await ensureLinkedProject();
    process.exit(0);
  }

  if (command === 'db:push') {
    await ensureLinkedProject();
    await executeSupabase([
      '--yes',
      'db',
      'push',
      '--linked',
      '--include-all',
      ...extraArgs,
    ]);
    process.exit(0);
  }

  if (command === 'db:dry-run') {
    await ensureLinkedProject();
    await executeSupabase([
      '--yes',
      'db',
      'push',
      '--linked',
      '--include-all',
      '--dry-run',
      ...extraArgs,
    ]);
    process.exit(0);
  }

  if (command === 'migration:list') {
    await ensureLinkedProject();
    await executeSupabase(['migration', 'list', '--linked', ...extraArgs]);
    process.exit(0);
  }

  if (command === 'types') {
    await ensureLinkedProject();

    const output = await executeSupabase(
      [
        'gen',
        'types',
        'typescript',
        '--linked',
        '--schema',
        'public',
        ...extraArgs,
      ],
      { captureOutput: true },
    );
    const targetPath = path.resolve(
      workspaceRoot,
      'src/lib/supabase/database.types.ts',
    );

    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, output, 'utf8');
    console.log(
      `Wrote Supabase types to ${path.relative(workspaceRoot, targetPath)}.`,
    );
    process.exit(0);
  }

  printUsage();
  process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function printUsage() {
  console.log(`Usage: node scripts/supabase-cli.mjs <command>

Commands:
  link            Link this repo to the remote Supabase project
  db:dry-run      Preview pending migrations on the linked Supabase project
  db:push         Apply pending migrations to the linked Supabase project
  migration:list  Show local and remote migration history
  types           Generate src/lib/supabase/database.types.ts from the linked project

The script loads .env.local by default. Override it with SUPABASE_ENV_FILE=/path/to/file.`);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const fileContents = readFileSync(filePath, 'utf8');

  for (const rawLine of fileContents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requireEnvVar(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to ${path.basename(envFilePath)} or export it in your shell.`,
    );
  }

  return value;
}

function resolveSupabaseExecutable() {
  const localBinary = path.resolve(
    workspaceRoot,
    process.platform === 'win32'
      ? 'node_modules/.bin/supabase.cmd'
      : 'node_modules/.bin/supabase',
  );

  if (existsSync(localBinary)) {
    return {
      executable: localBinary,
      argsPrefix: [],
    };
  }

  return {
    executable: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    argsPrefix: ['supabase'],
  };
}

async function ensureLinkedProject() {
  const projectRef = requireEnvVar('SUPABASE_PROJECT_REF');
  await executeSupabase(['--yes', 'link', '--project-ref', projectRef]);
}

async function executeSupabase(args, options = { captureOutput: false }) {
  const { executable, argsPrefix } = resolveSupabaseExecutable();

  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...argsPrefix, ...args], {
      cwd: workspaceRoot,
      env: process.env,
      stdio: options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });

    let stdout = '';
    let stderr = '';

    if (options.captureOutput) {
      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          stderr.trim() ||
            `Supabase CLI command failed with exit code ${code}.`,
        ),
      );
    });
  });
}
