import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptPath);
const appRoot = path.resolve(scriptDirectory, '..');
const excludedDirectoryNames = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'node_modules',
  'out',
]);
const supportedExtensions = new Set([
  '.cjs',
  '.css',
  '.js',
  '.jsx',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
]);

export async function processCodeComments(root, { write }) {
  const changedFiles = [];
  await walk(root, root, write, changedFiles);
  return changedFiles.sort();
}

export function stripFileComments(filePath, source) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.css') {
    return stripCssComments(source);
  }

  if (extension === '.sql') {
    return stripSqlComments(source);
  }

  return stripTypeScriptComments(
    source,
    extension === '.jsx' || extension === '.tsx',
  );
}

async function walk(root, directory, write, changedFiles) {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!excludedDirectoryNames.has(entry.name)) {
        await walk(root, absolutePath, write, changedFiles);
      }
      continue;
    }

    if (!entry.isFile() || !isSupportedFile(root, absolutePath)) {
      continue;
    }

    const original = await fs.readFile(absolutePath, 'utf8');
    const stripped = stripBlankLineWhitespace(
      stripFileComments(absolutePath, original),
    );

    if (stripped === original) {
      continue;
    }

    changedFiles.push(normalizePath(path.relative(root, absolutePath)));

    if (write) {
      await fs.writeFile(absolutePath, stripped);
    }
  }
}

function isSupportedFile(root, filePath) {
  const relativePath = normalizePath(path.relative(root, filePath));

  if (relativePath === 'next-env.d.ts') {
    return false;
  }

  if (/^public\/(?:sw|swe-worker).*\.js$/u.test(relativePath)) {
    return false;
  }

  return supportedExtensions.has(path.extname(filePath).toLowerCase());
}

function stripTypeScriptComments(source, jsx) {
  const sourceFile = ts.createSourceFile(
    jsx ? 'source.tsx' : 'source.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const ranges = [];
  const knownRanges = new Set();

  function collectRanges(position, getRanges) {
    for (const range of getRanges(source, position) ?? []) {
      const key = `${range.pos}:${range.end}`;

      if (!knownRanges.has(key)) {
        knownRanges.add(key);
        ranges.push([range.pos, range.end]);
      }
    }
  }

  function visit(node) {
    collectRanges(node.pos, ts.getLeadingCommentRanges);
    collectRanges(node.end, ts.getTrailingCommentRanges);

    for (const child of node.getChildren(sourceFile)) {
      visit(child);
    }
  }

  visit(sourceFile);
  ranges.sort(([firstStart], [secondStart]) => firstStart - secondStart);
  return removeRanges(source, ranges);
}

function stripCssComments(source) {
  const ranges = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (char === '"' || char === "'") {
      index = readQuoted(source, index, char);
      continue;
    }

    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      const commentEnd = end === -1 ? source.length : end + 2;
      ranges.push([index, commentEnd]);
      index = commentEnd;
      continue;
    }

    index += 1;
  }

  return removeRanges(source, ranges);
}

function stripSqlComments(source) {
  const ranges = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (char === "'" || char === '"') {
      index = readSqlQuoted(source, index, char);
      continue;
    }

    if (char === '$') {
      const dollarQuote = readDollarQuoted(source, index);

      if (dollarQuote !== null) {
        index = dollarQuote;
        continue;
      }
    }

    if (source.startsWith('--', index)) {
      const lineEnd = findLineBreakStart(source, index);
      const commentEnd = lineEnd === -1 ? source.length : lineEnd;
      ranges.push([index, commentEnd]);
      index = commentEnd;
      continue;
    }

    if (source.startsWith('/*', index)) {
      const commentEnd = findSqlBlockCommentEnd(source, index);
      ranges.push([index, commentEnd]);
      index = commentEnd;
      continue;
    }

    index += 1;
  }

  return removeRanges(source, ranges);
}

function readQuoted(source, startIndex, quote) {
  let index = startIndex + 1;

  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }

    if (source[index] === quote) {
      return index + 1;
    }

    index += 1;
  }

  return source.length;
}

function readSqlQuoted(source, startIndex, quote) {
  let index = startIndex + 1;

  while (index < source.length) {
    if (source[index] === quote) {
      if (source[index + 1] === quote) {
        index += 2;
        continue;
      }

      return index + 1;
    }

    if (source[index] === '\\') {
      index += 2;
      continue;
    }

    index += 1;
  }

  return source.length;
}

function readDollarQuoted(source, startIndex) {
  const delimiter = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/u.exec(
    source.slice(startIndex),
  )?.[0];

  if (!delimiter) {
    return null;
  }

  const end = source.indexOf(delimiter, startIndex + delimiter.length);
  return end === -1 ? source.length : end + delimiter.length;
}

function findSqlBlockCommentEnd(source, startIndex) {
  let depth = 1;
  let index = startIndex + 2;

  while (index < source.length && depth > 0) {
    if (source.startsWith('/*', index)) {
      depth += 1;
      index += 2;
      continue;
    }

    if (source.startsWith('*/', index)) {
      depth -= 1;
      index += 2;
      continue;
    }

    index += 1;
  }

  return index;
}

function removeRanges(source, ranges) {
  let output = '';
  let lastIndex = 0;

  for (const [start, end] of ranges) {
    output += source.slice(lastIndex, start);
    output += replacementForRemovedBlock(source.slice(start, end));
    lastIndex = end;
  }

  return output + source.slice(lastIndex);
}

function replacementForRemovedBlock(block) {
  const lineBreaks = block.match(/\r\n|\r|\n/g);
  return lineBreaks ? lineBreaks.join('') : ' ';
}

function findLineBreakStart(source, startIndex) {
  const lineFeed = source.indexOf('\n', startIndex);
  const carriageReturn = source.indexOf('\r', startIndex);

  if (lineFeed === -1) {
    return carriageReturn;
  }

  if (carriageReturn === -1) {
    return lineFeed;
  }

  return Math.min(lineFeed, carriageReturn);
}

function stripBlankLineWhitespace(source) {
  return source.replace(/^[ \t]+$/gm, '');
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const changedFiles = await processCodeComments(appRoot, {
    write: !checkOnly,
  });

  if (changedFiles.length === 0) {
    console.log('Nenhum comentário de código encontrado.');
    return;
  }

  if (checkOnly) {
    console.error('Comentários de código encontrados:');
    process.exitCode = 1;
  } else {
    console.log('Comentários de código removidos:');
  }

  for (const file of changedFiles) {
    console.error(`- ${file}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await main();
}
