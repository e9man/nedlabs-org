#!/usr/bin/env node
// check-parity.js <design.dc.html> <generated.html>
//
// Fails if any visible string in the design is absent from the generated page.
// This is the gate that catches "regenerated with the old template", where the
// build succeeds and the page silently lacks the new copy.
//
// Team member and institution names are skipped: they live in the DCLogic data
// arrays, not the design markup, so they never appear on the design side.
//
// Exit 0 = parity, 1 = missing copy, 3 = usage.
'use strict';
const fs = require('fs');

const [, , designPath, pagePath] = process.argv;
if (!designPath || !pagePath) {
  console.error('usage: check-parity.js <design.dc.html> <generated.html>');
  process.exit(3);
}

const strip = s =>
  s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, '\n');

const entities = s =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const lines = src =>
  new Set(
    entities(strip(src))
      .split('\n')
      .map(l => l.replace(/\s+/g, ' ').trim())
      .filter(l => l && !l.startsWith('{{') && !/^[\d\s]*$/.test(l))
  );

const design = lines(fs.readFileSync(designPath, 'utf8'));
const page = lines(fs.readFileSync(pagePath, 'utf8'));

const missing = [...design].filter(l => !page.has(l));

if (missing.length) {
  console.error(`PARITY FAIL: ${missing.length} string(s) in the design are missing from the page:`);
  missing.forEach(m => console.error('  - ' + m.slice(0, 160)));
  process.exit(1);
}
console.log(`PARITY OK: all ${design.size} design strings present in the page`);
