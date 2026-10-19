#!/usr/bin/env node
// D2 lint: counts banned "AI look" classes and hype words per file (agents/directives/D2-minimal-human-ui.md).
// Usage: node agents/checks/d2.mjs [file ...]   (no args = all of src/)
import fs from 'node:fs';
import path from 'node:path';

const RULES = [
  ['dark+neon', /bg-(black|zinc-9\d\d|neutral-9\d\d|slate-9\d\d|gray-9\d\d)[^"'`]*text-(green|emerald|lime|cyan|teal)-[2-4]00|text-(green|emerald|lime|cyan|teal)-[2-4]00[^"'`]*bg-(black|zinc-9\d\d|neutral-9\d\d|slate-9\d\d|gray-9\d\d)/g],
  ['neon-green', /\b(text|bg)-(green|emerald|lime)-(300|400)\b|\bbg-(green|emerald)-9[05]0\b/g],
  ['gradient', /\bbg-gradient-to-|\bbg-linear-to-|\bfrom-(purple|violet|indigo|fuchsia|pink|cyan|teal|emerald|blue|sky)-/g],
  ['off-palette', /\b(text|bg|border|ring|from|to)-(purple|violet|indigo|fuchsia|cyan|teal|sky)-\d{2,3}/g],
  ['glass/glow', /\bbackdrop-blur(-\w+)?\b(?![^"'`]*fixed)|\bshadow-(xl|2xl)\b|\bdrop-shadow-(lg|xl|2xl)\b/g],
  ['eyebrow', /\buppercase\b[^"'`]*\btracking-(widest|\[0\.[2-9])/g],
  ['mono', /\bfont-mono\b/g],
  ['sparkle', /\bSparkles\b|✨|🚀|🔥|💫|⚡/g],
  ['hype-words', /\b(seamless(ly)?|effortless(ly)?|elevate|unlock|leverage|empower|robust|cutting-edge|revolutionary|supercharge|game-?changer|delve|AI-powered)\b/gi],
];

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : /\.(tsx|ts|html)$/.test(e.name) ? [p] : [];
});
const files = process.argv.slice(2).length ? process.argv.slice(2) : walk('src');

let total = 0;
const rows = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const hits = RULES.map(([name, re]) => [name, (src.match(re) || []).length]).filter(([, n]) => n);
  const n = hits.reduce((s, [, c]) => s + c, 0);
  if (n) rows.push([n, f.replace(/\\/g, '/'), hits.map(([k, c]) => `${k}:${c}`).join(' ')]);
  total += n;
}
rows.sort((a, b) => b[0] - a[0]).forEach(([n, f, d]) => console.log(`${String(n).padStart(4)}  ${f}  ${d}`));
console.log(`\nD2 hits: ${total} in ${rows.length} files (review each: some are legitimate, e.g. font-mono on booking refs)`);
