#!/usr/bin/env node
/**
 * subset-cjk.mjs: subset the Chinese display face to the characters the site uses.
 *
 * public/fonts/kz-serif-sc.woff2 ("KZ Serif SC") is Noto Serif SC (SIL OFL 1.1),
 * cut down to only the CJK characters that appear in the Chinese content, so
 * the /zh/ pages can use a self-hosted Song face without shipping a 10+ MB font.
 *
 * Collected from src/ (no deps, runs on plain Node):
 *   - *.json          every string EXCEPT those under an "en" key or a "_comment"
 *                     style key (so the zh branches of src/content_data/*.json,
 *                     plus any shared strings)
 *   - *.md / *.mdx    whole file, except *.en.md / *.en.mdx
 *                     (src/content_data/about.zh.md, src/content/blog/*.zh.md)
 *   - *.astro / *.ts / *.js / *.mjs
 *                     every CJK character anywhere in the file (ui.zh in
 *                     src/i18n/content.ts, inline zh strings in components,
 *                     pages and layouts; comments over-collect a little, harmless)
 *   - ALWAYS below    text produced at runtime rather than written in src/
 *                     (Intl zh-CN dates: 年 月 日) and common CJK punctuation
 * Characters kept: U+3000-303F, U+4E00-9FFF, U+FF00-FFEF, and · — ‘ ’ “ ” …
 *
 * Usage (from version1/):
 *   npm run fonts:zh
 *   node scripts/subset-cjk.mjs
 *       Check mode (the default). Collects the character set and compares it
 *       with scripts/zh-chars.txt, the list of characters the committed woff2
 *       was built from. Exits 1 and lists the characters that are missing, so
 *       new Chinese copy that the font does not cover is caught.
 *
 *   node scripts/subset-cjk.mjs --build <source-font>
 *   PYFTSUBSET=/path/to/pyftsubset node scripts/subset-cjk.mjs --build <source-font>
 *       Rebuild. Writes scripts/zh-chars.txt, then runs fontTools' pyftsubset
 *       (env PYFTSUBSET, else `pyftsubset` on PATH; `pip install fonttools brotli`)
 *       to write public/fonts/kz-serif-sc.woff2. Characters the source font has
 *       no glyph for are reported and left out of zh-chars.txt.
 *       Source font used: NotoSerifSC[wght].ttf from google/fonts (ofl/notoserifsc),
 *       the variable build (wght 200-900) that carries the chws / vchw features:
 *       https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const CHARS_FILE = path.join(ROOT, 'scripts', 'zh-chars.txt');
const FONT_FILE = path.join(ROOT, 'public', 'fonts', 'kz-serif-sc.woff2');
const rel = (p) => path.relative(ROOT, p);

const CJK = /[　-〿一-鿿＀-￯·—‘’“”…]/gu;
const ALWAYS = '年月日' + '、。〈〉《》「」『』【】〔〕' + '，．：；！？（）～' + '·—‘’“”…';

// ---------------------------------------------------------------- collect

function addChars(set, text) {
  for (const m of text.matchAll(CJK)) set.add(m[0]);
}

/** Walk parsed JSON; skip "en" branches and "_"-prefixed (comment) keys. */
function addJson(set, node) {
  if (typeof node === 'string') addChars(set, node);
  else if (Array.isArray(node)) node.forEach((v) => addJson(set, v));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'en' || k.startsWith('_')) continue;
      addJson(set, v);
    }
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function collect() {
  const set = new Set();
  addChars(set, ALWAYS);
  for (const file of walk(SRC)) {
    const base = path.basename(file);
    let text;
    if (/\.json$/i.test(base)) {
      text = readFileSync(file, 'utf8');
      try {
        addJson(set, JSON.parse(text));
      } catch (err) {
        throw new Error(`${rel(file)}: ${err.message}`);
      }
    } else if (/\.mdx?$/i.test(base)) {
      if (/\.en\.mdx?$/i.test(base)) continue;
      addChars(set, readFileSync(file, 'utf8'));
    } else if (/\.(astro|[cm]?[jt]s)$/i.test(base)) {
      addChars(set, readFileSync(file, 'utf8'));
    }
  }
  return set;
}

const sortChars = (iter) => [...iter].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));

/** 50 characters per line keeps diffs of zh-chars.txt readable. */
function formatChars(chars) {
  const lines = [];
  for (let i = 0; i < chars.length; i += 50) lines.push(chars.slice(i, i + 50).join(''));
  return lines.join('\n') + '\n';
}

const hex = (c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');

// ---------------------------------------------------------------- check

function check() {
  const wanted = collect();
  let covered;
  try {
    covered = new Set(Array.from(readFileSync(CHARS_FILE, 'utf8').replace(/\s+/g, '')));
  } catch {
    console.error(`${rel(CHARS_FILE)} not found; run: node scripts/subset-cjk.mjs --build <source-font>`);
    process.exit(1);
  }
  const missing = sortChars([...wanted].filter((c) => !covered.has(c)));
  if (missing.length) {
    console.error(
      `${rel(FONT_FILE)} lacks ${missing.length} character(s) used in src/:\n  ` +
        missing.map((c) => `${c} ${hex(c)}`).join('\n  ') +
        `\nRebuild: node scripts/subset-cjk.mjs --build <path/to/NotoSerifSC[wght].ttf>`,
    );
    process.exit(1);
  }
  console.log(`ok: all ${wanted.size} collected characters are in ${rel(FONT_FILE)} (${covered.size} covered).`);
}

// ---------------------------------------------------------------- build

function subset(pyftsubset, source) {
  return spawnSync(
    pyftsubset,
    [
      source,
      `--text-file=${CHARS_FILE}`,
      '--layout-features=*',
      '--flavor=woff2',
      `--output-file=${FONT_FILE}`,
      // --no-hinting / --desubroutinize measured: no gain on this glyf source.
      // keep copyright, names, version, license + license URL (OFL notice)
      '--name-IDs=0,1,2,3,4,5,6,13,14',
      '--no-ignore-missing-unicodes',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
}

function build(source) {
  if (!source) {
    console.error('usage: node scripts/subset-cjk.mjs --build <source-font>');
    process.exit(2);
  }
  source = path.resolve(process.cwd(), source);
  const pyftsubset = process.env.PYFTSUBSET || 'pyftsubset';
  const chars = collect();
  mkdirSync(path.dirname(FONT_FILE), { recursive: true });

  const dropped = [];
  for (;;) {
    writeFileSync(CHARS_FILE, formatChars(sortChars(chars)));
    const r = subset(pyftsubset, source);
    if (r.error) {
      console.error(`could not run ${pyftsubset}: ${r.error.message}\n(pip install fonttools brotli, or set PYFTSUBSET)`);
      process.exit(1);
    }
    if (r.status === 0) break;
    // Source font has no glyph for some requested characters: drop them and retry.
    const absent = /MissingUnicodesSubsettingError/.test(r.stderr)
      ? [...r.stderr.matchAll(/U\+([0-9A-F]{4,6})/g)].map((m) => String.fromCodePoint(parseInt(m[1], 16)))
      : [];
    const removable = absent.filter((c) => chars.has(c));
    if (!removable.length) {
      process.stderr.write(r.stderr);
      process.exit(r.status || 1);
    }
    removable.forEach((c) => chars.delete(c));
    dropped.push(...removable);
  }

  if (dropped.length) {
    console.warn(
      `warning: source font has no glyph for ${dropped.length} character(s); they fall back to system fonts:\n  ` +
        sortChars(dropped).map((c) => `${c} ${hex(c)}`).join('\n  '),
    );
  }
  const kb = (statSync(FONT_FILE).size / 1024).toFixed(1);
  console.log(`wrote ${rel(FONT_FILE)} (${kb} KB, ${chars.size} characters) and ${rel(CHARS_FILE)}`);
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2);
const i = args.indexOf('--build');
if (i !== -1) build(args[i + 1]);
else check();
