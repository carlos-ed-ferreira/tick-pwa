export function assertMigrationHistoryIsSynchronized(output) {
  const rows = output
    .replaceAll(/\u001b\[[0-9;]*m/gu, '')
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*(\d{14})?\s*[│|]\s*(\d{14})?\s*[│|]/u))
    .filter(Boolean)
    .map((match) => ({ local: match[1] ?? '', remote: match[2] ?? '' }));

  if (rows.length === 0) {
    throw new Error('Could not parse the migration history.');
  }

  const differences = rows
    .filter(({ local, remote }) => local !== remote)
    .map(({ local, remote }) =>
      local ? `${local}/local-only` : `${remote || 'unknown'}/remote-only`,
    );

  if (differences.length > 0) {
    throw new Error(`Migration history differs: ${differences.join(', ')}`);
  }
}
