import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

if (!existsSync('.next/BUILD_ID'))
  throw new Error('Run make build before measuring the bundle.');
const files = readdirSync('.next/static', { recursive: true })
  .filter((file) => file.endsWith('.js'))
  .map((file) => path.join('.next/static', file));
for (const file of readdirSync('public')) {
  if (/^(sw|swe-worker.*)\.js$/u.test(file))
    files.push(path.join('public', file));
}
const assets = files.map((file) => {
  const content = readFileSync(file);
  return { file, bytes: content.length, gzipBytes: gzipSync(content).length };
});
const report = {
  createdAt: new Date().toISOString(),
  buildId: readFileSync('.next/BUILD_ID', 'utf8').trim(),
  assetCount: assets.length,
  totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  totalGzipBytes: assets.reduce((sum, asset) => sum + asset.gzipBytes, 0),
  assets: assets.sort((first, second) => second.bytes - first.bytes),
};
mkdirSync('.next/benchmarks', { recursive: true });
writeFileSync(
  '.next/benchmarks/bundle-latest.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      assetCount: report.assetCount,
      totalBytes: report.totalBytes,
      totalGzipBytes: report.totalGzipBytes,
    },
    null,
    2,
  ),
);
