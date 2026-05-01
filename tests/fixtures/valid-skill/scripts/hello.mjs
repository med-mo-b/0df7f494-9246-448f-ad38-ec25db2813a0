#!/usr/bin/env node
process.stdout.write(`hello ${process.argv.slice(2).join(' ')}\n`.trim() + '\n');
process.exit(0);
