import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const children = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? filesUnder(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    ),
  );
  return children.flat();
}

function withoutCode(text) {
  return text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
}

function anchors(text) {
  const values = new Set();
  const counts = new Map();
  for (const [, heading] of withoutCode(text).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = heading
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, '')
      .replaceAll(' ', '-');
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    values.add(count ? `${base}-${count}` : base);
  }
  return values;
}

const roots = ['docs', '.agents/skills', '.codex/skills', '.claude/skills'];
const files = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'REVIEW.md',
  ...(await Promise.all(roots.map(filesUnder)))
    .flat()
    .filter((file) => file.endsWith('.md')),
];
const errors = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const content = withoutCode(text);
  const links = [...content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map(
    (match) => match[1],
  );
  links.push(
    ...[...content.matchAll(/<img[^>]+src="([^"]+)"/g)].map(
      (match) => match[1],
    ),
  );
  for (const link of links) {
    if (/^[a-z]+:|^\/\//i.test(link)) continue;
    const [rawPath, fragment] = link.split('#');
    const target = rawPath
      ? path.resolve(
          path.dirname(file),
          decodeURIComponent(rawPath.replace(/^<|>$/g, '')),
        )
      : path.resolve(file);
    try {
      await stat(target);
      if (
        fragment &&
        target.endsWith('.md') &&
        !anchors(await readFile(target, 'utf8')).has(
          decodeURIComponent(fragment),
        )
      )
        errors.push(`${file}: ancora ausente: ${link}`);
    } catch {
      errors.push(`${file}: destino ausente: ${link}`);
    }
  }
  if (path.basename(file) === 'SKILL.md') {
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
    const name = frontmatter?.[1].match(/^name:\s*(.+)$/m)?.[1];
    if (
      !name ||
      name !== path.basename(path.dirname(file)) ||
      !/^[a-z0-9-]{1,64}$/.test(name) ||
      !/^description:\s*\S/m.test(frontmatter[1])
    )
      errors.push(`${file}: frontmatter invalido`);
  }
}
const canonical = await filesUnder('.agents/skills');
for (const mirrorRoot of ['.codex/skills', '.claude/skills']) {
  const expected = new Set();
  for (const file of canonical) {
    const counterpart = path.join(
      mirrorRoot,
      path.relative('.agents/skills', file),
    );
    expected.add(counterpart);
    try {
      if (!(await readFile(file)).equals(await readFile(counterpart)))
        errors.push(`${counterpart}: diferente da fonte ${file}`);
    } catch {
      errors.push(`${counterpart}: espelho ausente`);
    }
  }
  for (const file of await filesUnder(mirrorRoot)) {
    if (!expected.has(file)) errors.push(`${file}: recurso sem fonte canonica`);
  }
}
if (errors.length) {
  for (const error of errors) process.stderr.write(`${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Documentacao valida: ${files.length} Markdown; links, ancoras, skills e espelhos conferidos.\n`,
  );
}
