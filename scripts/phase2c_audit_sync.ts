import { readFileSync } from 'fs';

const storageFile = readFileSync('src/lib/storage.ts', 'utf8');

const lines = storageFile.split('\n');
const start = lines.findIndex(l => l.includes('syncFromSupabase:'));
const end = lines.findIndex((l, i) => i > start && l.includes('// 3. Sync Exams'));

console.log(lines.slice(start, end).join('\n'));
