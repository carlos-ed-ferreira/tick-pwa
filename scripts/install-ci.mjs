import { spawn } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function hasSupabaseReleaseDownload(output) {
  return (output.match(/https?:\/\/\S+/gu) ?? []).some((candidate) => {
    if (!URL.canParse(candidate)) return false;
    const url = new URL(candidate);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname.startsWith('/supabase/cli/releases/download/')
    );
  });
}

function isTransientDownloadFailure(error) {
  const output = error.installOutput ?? '';
  return (
    !error.signal &&
    /[/\\]node_modules[/\\]supabase(?:\r?\n|$)/u.test(output) &&
    output.includes('scripts/postinstall.js') &&
    hasSupabaseReleaseDownload(output) &&
    !/checksum mismatch|EINTEGRITY|EACCES|EPERM|\b40[134]\b|not supported/iu.test(
      output,
    ) &&
    /\b(?:50[0234]|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|Z_DATA_ERROR|Z_BUF_ERROR)\b|incorrect header check|unexpected end of (?:file|data)/iu.test(
      output,
    )
  );
}

export function executeNpmCi(executable) {
  return new Promise((resolve, reject) => {
    let output = '';
    const child = spawn(executable, ['ci'], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    const forward = (destination) => (chunk) => {
      output = (output + chunk.toString()).slice(-65536);
      destination.write(chunk);
    };
    child.stdout.on('data', forward(process.stdout));
    child.stderr.on('data', forward(process.stderr));
    child.on('error', reject);
    child.on('close', (exitCode, signal) => {
      if (exitCode === 0) resolve();
      else
        reject(
          Object.assign(new Error(`npm ci falhou (${signal ?? exitCode}).`), {
            exitCode: exitCode ?? 1,
            signal,
            installOutput: output,
          }),
        );
    });
  });
}

export async function installCi({
  execute = () => executeNpmCi(process.argv[2] ?? 'npm'),
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  write = console.error,
} = {}) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await execute();
      return;
    } catch (error) {
      if (attempt === 3 || !isTransientDownloadFailure(error)) throw error;
      const delay = attempt * 5000;
      write(
        `Download da CLI Supabase falhou temporariamente. Nova instalação ${attempt + 1}/3 em ${delay / 1000}s.`,
      );
      await wait(delay);
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await installCi();
  } catch (error) {
    console.error(error.message);
    process.exitCode = Number.isInteger(error.exitCode) ? error.exitCode : 1;
  }
}
