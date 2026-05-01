#!/usr/bin/env node
// Brainstorming skill: save the agreed-upon design document to disk.
//
// Reads the assembled markdown body from stdin and writes
// `DESIGN-<slug>-<YYYYMMDD-HHmm>.md` into the chosen output directory.
// Prints the absolute path of the written file on stdout.
//
// Usage:
//   echo "<full markdown body>" | node save_design.mjs \
//     --title "Pluggable cache layer" [--out ./design/] [--no-template]
//
// Zero external deps -- runs anywhere Node 18+ exists.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, '..');
const TEMPLATE_PATH = path.join(SKILL_ROOT, 'references', 'DESIGN_TEMPLATE.md');

function parseArgs(argv) {
  const args = { title: null, out: './design', useTemplate: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--title') {
      args.title = argv[++i] ?? null;
    } else if (arg === '--out') {
      args.out = argv[++i] ?? args.out;
    } else if (arg === '--no-template') {
      args.useTemplate = false;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      process.stderr.write(`save_design: unknown arg: ${arg}\n`);
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    [
      'save_design.mjs --title <title> [--out <dir>] [--no-template]',
      '',
      'Reads markdown from stdin and writes a timestamped DESIGN-*.md file.',
    ].join('\n') + '\n',
  );
}

function slugify(title) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled'
  );
}

function timestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}` +
    `${pad(date.getMonth() + 1)}` +
    `${pad(date.getDate())}-` +
    `${pad(date.getHours())}` +
    `${pad(date.getMinutes())}`
  );
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function applyTemplate(body, title) {
  const template = await readFile(TEMPLATE_PATH, 'utf8').catch(() => null);
  if (!template) {
    return body;
  }
  // If the body is "section-shaped" we leave it alone; the template is
  // mostly useful when the agent dumps a single blob.
  if (body.includes('## Components')) return body;
  return template
    .replace('{{TITLE}}', title)
    .replace('{{DATE}}', new Date().toISOString())
    .replace('{{SUMMARY}}', body.trim())
    .replace(/{{[A-Z_]+}}/g, '_to be filled in_');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.title) {
    process.stderr.write('save_design: --title is required\n');
    process.exit(2);
  }

  const body = (await readStdin()).trim();
  if (!body) {
    process.stderr.write('save_design: empty stdin -- nothing to save\n');
    process.exit(2);
  }

  const final = args.useTemplate ? await applyTemplate(body, args.title) : body;
  const outDir = path.resolve(args.out);
  await mkdir(outDir, { recursive: true });

  const file = path.join(
    outDir,
    `DESIGN-${slugify(args.title)}-${timestamp()}.md`,
  );
  await writeFile(file, final.endsWith('\n') ? final : `${final}\n`, 'utf8');
  process.stdout.write(`${file}\n`);
}

main().catch((err) => {
  process.stderr.write(`save_design: ${err?.message ?? err}\n`);
  process.exit(1);
});
