import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const baselinePath = 'docs/operations/baselines/quality.json';

function countLines(text) {
  return text.split(/\r?\n/u).filter((line) => line.trim()).length;
}

function functionName(node, source) {
  if (node.name) return node.name.getText(source);
  if (
    ts.isVariableDeclaration(node.parent) ||
    ts.isPropertyAssignment(node.parent)
  )
    return node.parent.name.getText(source);
  if (ts.isCallExpression(node.parent))
    return `${node.parent.expression.getText(source)} callback`;
  return 'anonymous';
}

function complexity(node) {
  let value = 1;
  function visit(child) {
    if (child !== node && ts.isFunctionLike(child)) return;
    if (
      ts.isIfStatement(child) ||
      ts.isConditionalExpression(child) ||
      ts.isCaseClause(child) ||
      ts.isCatchClause(child) ||
      ts.isForStatement(child) ||
      ts.isForOfStatement(child) ||
      ts.isForInStatement(child) ||
      ts.isWhileStatement(child) ||
      ts.isDoStatement(child) ||
      (ts.isBinaryExpression(child) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(child.operatorToken.kind)) ||
      child.questionDotToken ||
      (ts.isParameter(child) && child.initializer)
    )
      value += 1;
    ts.forEachChild(child, visit);
  }
  ts.forEachChild(node, visit);
  return value;
}

export function analyzeSource(text, filename) {
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const functions = {};
  const names = new Map();
  const imports = [];
  function visit(node, parent = '') {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isFunctionLike(node) && node.body) {
      const name = `${parent}/${functionName(node, source)}`;
      const index = names.get(name) ?? 0;
      names.set(name, index + 1);
      parent = `${name}#${index}`;
      functions[parent] = {
        lines: countLines(node.getText(source)),
        complexity: complexity(node),
      };
    }
    ts.forEachChild(node, (child) => visit(child, parent));
  }
  visit(source);
  const forbidden = filename.startsWith('src/lib/domain/')
    ? imports.filter((specifier) => {
        const target = specifier.startsWith('@/')
          ? `src/${specifier.slice(2)}`
          : specifier.startsWith('.')
            ? path.join(path.dirname(filename), specifier)
            : specifier;
        return /^(?:src\/(?:lib\/(?:db|supabase)|features|components|providers)(?:\/|$)|(?:react|next|dexie)(?:\/|$)|@supabase\/)/u.test(
          target,
        );
      })
    : [];
  return { lines: countLines(text), functions, imports, forbidden };
}

export function findCycleEdges(graph) {
  function reaches(current, target, visited) {
    if (current === target) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    return (graph.get(current) ?? []).some((next) =>
      reaches(next, target, visited),
    );
  }
  return [...graph]
    .flatMap(([from, targets]) =>
      targets
        .filter((target) => reaches(target, from, new Set()))
        .map((target) => `${from} -> ${target}`),
    )
    .sort();
}

export function compareQuality(current, baseline) {
  const failures = [];
  for (const [filename, metrics] of Object.entries(current.files)) {
    const previous = baseline.files[filename];
    if (metrics.lines > Math.max(800, previous?.lines ?? 0))
      failures.push(`${filename}: module grew past its line budget`);
    for (const [name, values] of Object.entries(metrics.functions)) {
      const previousFunction = previous?.functions[name];
      if (values.lines > Math.max(80, previousFunction?.lines ?? 0))
        failures.push(`${filename}: ${name} exceeds function size`);
      if (values.complexity > Math.max(10, previousFunction?.complexity ?? 0))
        failures.push(`${filename}: ${name} exceeds complexity`);
    }
    for (const dependency of metrics.forbidden)
      failures.push(`${filename}: prohibited domain dependency ${dependency}`);
  }
  for (const cycle of current.cycles)
    if (!baseline.cycles.includes(cycle)) failures.push(`New cycle: ${cycle}`);
  return failures;
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filename);
    return /\.(ts|tsx)$/u.test(filename) &&
      !filename.endsWith('database.types.ts')
      ? [filename]
      : [];
  });
}

function measureQuality(ref) {
  const files = {};
  for (const filename of sourceFiles('src')) {
    let text;
    try {
      text = ref
        ? execFileSync('git', ['show', `${ref}:${filename}`], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        : readFileSync(filename, 'utf8');
    } catch (error) {
      if (!ref) throw error;
      continue;
    }
    files[filename] = analyzeSource(text, filename);
  }
  const graph = new Map(
    Object.entries(files).map(([filename, metrics]) => [
      filename,
      metrics.imports.flatMap((specifier) => {
        const base = specifier.startsWith('@/')
          ? `src/${specifier.slice(2)}`
          : specifier.startsWith('.')
            ? path.join(path.dirname(filename), specifier)
            : '';
        const target =
          base &&
          [
            `${base}.ts`,
            `${base}.tsx`,
            `${base}/index.ts`,
            `${base}/index.tsx`,
          ].find((candidate) => files[candidate]);
        return target ? [target] : [];
      }),
    ]),
  );
  return { files, cycles: findCycleEdges(graph) };
}

function main() {
  const ref = process.argv[2] === '--baseline-ref' ? process.argv[3] : null;
  const current = measureQuality(ref);
  if (ref) {
    const files = Object.fromEntries(
      Object.entries(current.files).flatMap(([filename, metrics]) => {
        const functions = Object.fromEntries(
          Object.entries(metrics.functions).filter(
            ([, values]) => values.lines > 80 || values.complexity > 10,
          ),
        );
        return metrics.lines > 800 || Object.keys(functions).length
          ? [[filename, { lines: metrics.lines, functions }]]
          : [];
      }),
    );
    const metadata = {
      measuredAt: new Date().toISOString(),
      sourceRef: execFileSync('git', ['rev-parse', ref], {
        encoding: 'utf8',
      }).trim(),
      tool: 'TypeScript AST',
      version: ts.version,
      scope: 'src/**/*.ts, src/**/*.tsx excluding database.types.ts',
    };
    writeFileSync(
      baselinePath,
      `${JSON.stringify({ metadata, files, cycles: current.cycles }, null, 2)}\n`,
    );
    console.log(
      `Measured ${Object.keys(current.files).length} modules for review.`,
    );
    return;
  }
  if (!existsSync(baselinePath))
    throw new Error('Missing reviewed quality baseline.');
  const failures = compareQuality(
    current,
    JSON.parse(readFileSync(baselinePath, 'utf8')),
  );
  if (failures.length) throw new Error(failures.join('\n'));
  console.log('Structural and architecture ratchets passed.');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
