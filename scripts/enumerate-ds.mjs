#!/usr/bin/env node
/**
 * enumerate-ds.mjs — enumerate the @autodocdev/autodoc-ui surface actually
 * installed in a consumer repo. Zero dependencies, Node >= 18, read-only,
 * offline-safe (never queries the registry — GitHub Packages is auth-gated).
 *
 * Usage: node enumerate-ds.mjs [consumer-repo-root]
 * Output: JSON on stdout (see shapes below). Exit 0 on success, 1 when
 * enumeration is impossible (fallback instruction included in the output).
 *
 * Why this exists: every MFE pins a different exact version of the design
 * system and the lib keeps moving. Any static component list is born stale.
 * The ONLY trustworthy inventory is what the installed package itself carries.
 *
 * Source priority:
 *   1. dist/manifest.json — emitted by autodoc-ui builds that run
 *      scripts/generate-manifest.mjs (carries values/types/deprecated).
 *      Older published versions (0.1.x, <=0.2.12) do NOT have it.
 *   2. the types entry (dist/main.d.ts), following `export *` chains.
 *   3. the ESM main entry (dist/main.js).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

const PKG = '@autodocdev/autodoc-ui';
const root = resolve(process.argv[2] ?? process.cwd());

function readText(path) {
  // Strip a UTF-8 BOM if present (Windows tooling sometimes writes one).
  return readFileSync(path, 'utf8').replace(/^﻿/, '');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function declaredVersion() {
  try {
    const pkg = readJson(join(root, 'package.json'));
    return (
      pkg.dependencies?.[PKG] ??
      pkg.devDependencies?.[PKG] ??
      pkg.peerDependencies?.[PKG] ??
      null
    );
  } catch {
    return null;
  }
}

function fail(message, extra = {}) {
  process.stdout.write(JSON.stringify({ installed: false, ...extra, message }, null, 2) + '\n');
  process.exit(1);
}

// --- 1. Locate the installed package -------------------------------------
const installedDir = join(root, 'node_modules', ...PKG.split('/'));
const installedPkgPath = join(installedDir, 'package.json');

if (!existsSync(installedPkgPath)) {
  const declared = declaredVersion();
  fail(
    declared
      ? `${PKG} is declared (${declared}) but not installed. Run install first, then re-run this script. Do not import any DS symbol until enumeration succeeds.`
      : `${PKG} is neither installed nor declared in this repo's package.json. This repo does not use the design system — do not import from it.`,
    { declared },
  );
}

const installedPkg = readJson(installedPkgPath);
const version = installedPkg.version ?? 'unknown';
const declared = declaredVersion();

// --- 2/3. Parse export statements out of the types entry (or main.js) ----
// The package has no `exports` map. The published types entry may be a stub
// (`export * from './autodoc-ui/main'` — observed in the real 0.2.11 dist),
// so star re-exports are followed recursively to the actual barrel.
function parseExports(source) {
  const values = new Set();
  const types = new Set();
  // Normalize whitespace so brace groups spanning lines match.
  const flat = source.replace(/\s+/g, ' ');

  // export { default as Name } from '...' / export { A, B as C } from '...'
  // and Rollup's local form without a source: export { Button, Modal };
  const valueRe = /export\s*\{([^}]+)\}(?:\s*from\s*['"][^'"]+['"])?/g;
  // export type { A, B as C } from '...' (with or without a source)
  const typeRe = /export\s+type\s*\{([^}]+)\}(?:\s*from\s*['"][^'"]+['"])?/g;

  let m;
  while ((m = typeRe.exec(flat)) !== null) {
    for (const raw of m[1].split(',')) {
      const parts = raw.trim().split(/\s+as\s+/);
      for (const p of parts) if (p && p !== 'default') types.add(p.trim());
    }
  }
  // Strip type-export blocks before scanning value exports so nothing double-counts.
  const withoutTypes = flat.replace(typeRe, '');
  while ((m = valueRe.exec(withoutTypes)) !== null) {
    for (const raw of m[1].split(',')) {
      const entry = raw.trim();
      if (!entry) continue;
      const asMatch = entry.match(/^(?:default\s+as\s+)?(.+)$/);
      const name = asMatch[1].split(/\s+as\s+/).pop().trim();
      if (name && name !== 'default') {
        // `type X` inside a value block is still a type export.
        if (/^type\s+/.test(entry)) types.add(name.replace(/^type\s+/, ''));
        else values.add(name);
      }
    }
  }
  // Star re-exports to follow: export * from './x'  /  export * as ns from './x'
  const stars = [];
  const starRe = /export\s*\*\s*(?:as\s+\w+\s+)?from\s*['"]([^'"]+)['"]/g;
  let s;
  while ((s = starRe.exec(flat)) !== null) stars.push(s[1]);

  return { values: [...values].sort(), types: [...types].sort(), stars };
}

// Resolve a star re-export specifier relative to the file that declared it.
function resolveStar(fromFile, spec) {
  const base = join(dirname(fromFile), spec);
  for (const cand of [base, `${base}.d.ts`, `${base}.ts`, `${base}.js`, join(base, 'index.d.ts'), join(base, 'index.js')]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

// Parse a file and follow its `export *` chain (cycle-safe).
function collectExports(filePath, visited = new Set()) {
  if (visited.has(filePath)) return { values: new Set(), types: new Set() };
  visited.add(filePath);

  const { values, types, stars } = parseExports(readText(filePath));
  const allValues = new Set(values);
  const allTypes = new Set(types);

  for (const spec of stars) {
    if (!spec.startsWith('.')) continue; // only follow relative re-exports inside the package
    const target = resolveStar(filePath, spec);
    if (!target) continue;
    const nested = collectExports(target, visited);
    for (const v of nested.values) allValues.add(v);
    for (const t of nested.types) allTypes.add(t);
  }
  return { values: allValues, types: allTypes };
}

const typesEntry = installedPkg.types ?? installedPkg.typings ?? 'dist/main.d.ts';
const mainEntry = installedPkg.main ?? 'dist/main.js';

let source = null;
let parsed = null;
let deprecated = null;
const warnings = [];

// --- Preferred: the build-time manifest (newer autodoc-ui versions) --------
const manifestPath = join(installedDir, 'dist', 'manifest.json');
if (existsSync(manifestPath)) {
  try {
    const m = readJson(manifestPath);
    if (Array.isArray(m.values) && m.values.length > 0) {
      parsed = {
        values: [...m.values].sort(),
        types: Array.isArray(m.types) ? [...m.types].sort() : null,
      };
      deprecated = Array.isArray(m.deprecated) ? [...m.deprecated].sort() : [];
      source = 'dist/manifest.json';
      if (m.version && m.version !== version) {
        warnings.push(
          `manifest.json says ${m.version} but package.json says ${version} — stale manifest inside the package; trust package.json and consider re-verifying.`,
        );
      }
    }
  } catch {
    // Malformed manifest: fall through to the parser chain below.
  }
}

const typesPath = join(installedDir, typesEntry);
if (!parsed && existsSync(typesPath)) {
  const collected = collectExports(typesPath);
  parsed = { values: [...collected.values].sort(), types: [...collected.types].sort() };
  source = typesEntry;
}

if (!parsed || (parsed.values.length === 0 && !(parsed.types?.length > 0))) {
  // Fallback 1: the ESM main file also carries `export { ... }` statements.
  const mainPath = join(installedDir, mainEntry);
  if (existsSync(mainPath)) {
    const collected = collectExports(mainPath);
    parsed = { values: [...collected.values].sort(), types: null }; // main.js carries no type exports
    source = mainEntry;
  }
}

if (!parsed || (parsed.values.length === 0 && !(parsed.types?.length > 0))) {
  // Fallback 2: hard fail with the standing instruction.
  fail(
    `Could not enumerate ${PKG}@${version}. Treat every DS symbol as unverified: open node_modules/${PKG}/dist and confirm the export exists before writing any import. NEVER assume a component exists.`,
    { installed: true, version, declared },
  );
}

// --- 4. Output ------------------------------------------------------------
if (declared && declared !== version) {
  warnings.push(
    `Declared version (${declared}) differs from installed (${version}) — stale install; run install and re-enumerate.`,
  );
}

process.stdout.write(
  JSON.stringify(
    {
      installed: true,
      version,
      declared,
      source,
      values: parsed.values,
      types: parsed.types,
      deprecated, // array when the manifest provides it; null when enumerated by parsing
      warnings,
    },
    null,
    2,
  ) + '\n',
);
