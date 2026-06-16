/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.cjs',
  '.mjs',
  '.json',
  '.md',
  '.css',
  '.env',
  '.example',
]);

const SKIP_DIRS = new Set(['.git', '.next', 'node_modules', '.mysql-data']);
const SKIP_FILES = new Set([path.normalize('scripts/check-encoding.cjs')]);
const MOJIBAKE_PATTERNS = [
  /\uFFFD/,
  /\?몄/,
  /\?대/,
  /\?좎/,
  /\?뱀/,
  /異쒖/,
  /寃곗/,
  /泥/,
  /愿/,
  /媛/,
  /\?щ퉬/,
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (TARGET_EXTENSIONS.has(path.extname(entry.name)) || entry.name.startsWith('.env')) {
      files.push(fullPath);
    }
  }
  return files;
}

function lineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

const findings = [];

for (const file of walk(ROOT)) {
  if (SKIP_FILES.has(path.relative(ROOT, file))) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of MOJIBAKE_PATTERNS) {
    const match = pattern.exec(content);
    if (match) {
      findings.push({
        file: path.relative(ROOT, file),
        line: lineNumber(content, match.index),
        pattern: pattern.source,
      });
      break;
    }
  }
}

if (findings.length > 0) {
  console.error('Mojibake-looking text was found. Please fix these before shipping:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} (${finding.pattern})`);
  }
  process.exit(1);
}

console.log('Encoding check passed.');
