// Эмодзи должны отображаться на Android 8+ (Unicode ≤ 10): новые символы видны как «квадратики»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(js|html|css)$/.test(f) && files.push(p); } })('src');
files.push('index.html');

// Блок U+1FA70–U+1FAFF (Unicode 12+) и отдельные символы Unicode 11
const BANNED = /[\u{1FA70}-\u{1FAFF}\u{1F9FC}\u{1F9D8}\u{1F976}\u{1F977}\u{1F9B0}-\u{1F9B9}\u{1F9C1}\u{1F9C2}]/u;

test('нет эмодзи, которых нет на Android 8', () => {
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => assert.ok(!BANNED.test(l), `${f}:${i + 1}: ${l.trim().slice(0, 60)}`));
  }
});
