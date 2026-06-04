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
  if (command === 'start') {
    await startSupabase(extraArgs);
    process.exit(0);
  }

  if (command === 'stop') {
    await executeSupabase(['stop', ...extraArgs]);
    process.exit(0);
  }

  if (command === 'status') {
    await executeSupabase(['status', ...extraArgs]);
    process.exit(0);
  }

  if (command === 'db:reset') {
    await executeSupabase(['db', 'reset', ...extraArgs]);
    process.exit(0);
  }

  if (command === 'types:local') {
    const output = await executeSupabase(
      [
        'gen',
        'types',
        'typescript',
        '--local',
        '--schema',
        'public',
        ...extraArgs,
      ],
      { captureOutput: true },
    );

    writeTypes(output);
    process.exit(0);
  }

  if (command === 'prod:db:push') {
    ensureProductionCommandAllowed();
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

  if (command === 'prod:db:dry-run') {
    ensureProductionCommandAllowed();
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

  if (command === 'prod:types') {
    ensureProductionCommandAllowed();
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

    writeTypes(output);
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
  start            Start the local Supabase stack
  stop             Stop the local Supabase stack
  status           Show local Supabase services and keys
  db:reset         Reset the local Supabase database
  types:local      Generate src/lib/supabase/database.types.ts from local Supabase
  prod:db:dry-run  Preview production migrations on GitHub Actions only
  prod:db:push     Apply production migrations on GitHub Actions only
  prod:types       Generate types from production on GitHub Actions only

The script loads .env.local by default. Override it with SUPABASE_ENV_FILE=/path/to/file.
Production commands are blocked unless GITHUB_ACTIONS=true.`);
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

function ensureProductionCommandAllowed() {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error(
      'Production Supabase commands are restricted to GitHub Actions.',
    );
  }
}

function writeTypes(output) {
  const targetPath = path.resolve(
    workspaceRoot,
    'src/lib/supabase/database.types.ts',
  );

  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, output, 'utf8');
  console.log(
    `Wrote Supabase types to ${path.relative(workspaceRoot, targetPath)}.`,
  );
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

async function startSupabase(args) {
  try {
    await executeSupabase(['start', ...args], {
      captureOutput: true,
      teeOutput: true,
    });
    return;
  } catch (error) {
    if (!isRecoverablePartialStart(error)) {
      throw error;
    }

    console.warn(
      'Detected a partial Supabase local stack. Stopping it before retrying start...',
    );
    await executeSupabase(['stop']);
    await executeSupabase(['start', ...args]);
  }
}

function isRecoverablePartialStart(error) {
  const output = error instanceof Error ? error.output : undefined;

  if (typeof output !== 'string') {
    return false;
  }

  return (
    output.includes('supabase start is already running') &&
    output.includes('container is not running')
  );
}

async function executeSupabase(
  args,
  options = { captureOutput: false, teeOutput: false },
) {
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
        const text = chunk.toString();
        stdout += text;

        if (options.teeOutput) {
          process.stdout.write(text);
        }
      });
      child.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;

        if (options.teeOutput) {
          process.stderr.write(text);
        }
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

      const output = `${stdout}${stderr}`;
      const error = new Error(
        stderr.trim() ||
          stdout.trim() ||
          `Supabase CLI command failed with exit code ${code}.`,
      );
      error.output = output;

      reject(error);
    });
  });
}
