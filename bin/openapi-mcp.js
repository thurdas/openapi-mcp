#!/usr/bin/env node
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsx = resolve(__dirname, '../node_modules/.bin/tsx');
const entry = resolve(__dirname, '../src/index.ts');

const result = spawnSync(tsx, [entry, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
