#!/usr/bin/env node
// classify.js <old.dc.html> <new.dc.html>
//
// Decides how a Claude Design change affects the static build.
//
//   IDENTICAL   nothing to do
//   CONTENT     only visible text and/or the DCLogic data arrays moved.
//               template.html still needs the new strings pasted in, but the
//               structure it encodes is still correct.
//   STRUCTURAL  markup, attributes, inline styles, or DCLogic control flow
//               moved. template.html is a hand translation of that structure,
//               so a human has to re-translate. Regenerating alone WILL ship
//               the old layout wearing the new copy.
//
// Exit codes: 0 identical, 1 content, 2 structural, 3 usage/error.
'use strict';
const fs = require('fs');

const [, , oldPath, newPath] = process.argv;
if (!oldPath || !newPath) {
  console.error('usage: classify.js <old.dc.html> <new.dc.html>');
  process.exit(3);
}

const read = p => fs.readFileSync(p, 'utf8');

const SCRIPT_RE = /<script\b[^>]*type=["']text\/x-dc["'][\s\S]*?<\/script>/i;

// The two literals that are pure data. Everything else in the script is logic.
const DATA_ARRAY_RE = /const\s+(raw|institutions)\s*=\s*\[[\s\S]*?\n\s*\];/g;

function splitScript(src) {
  const m = src.match(SCRIPT_RE);
  const script = m ? m[0] : '';
  const markup = src.replace(SCRIPT_RE, '');
  return { markup, script };
}

// Tags + attributes, text nodes discarded. This is the shape template.html encodes.
function skeleton(markup) {
  const tags = markup.match(/<[^>]+>/g) || [];
  return tags
    .map(t => t.replace(/\s+/g, ' ').trim())
    // {{ expr }} inside attributes is a binding, not structure we can diff usefully
    .filter(t => !/^<!--/.test(t))
    .join('\n');
}

function visibleText(markup) {
  return markup
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('{{'))
    .join('\n');
}

const scriptLogic = script => script.replace(DATA_ARRAY_RE, 'const $1 = [/*DATA*/];');
const scriptData = script => (script.match(DATA_ARRAY_RE) || []).join('\n');

const a = splitScript(read(oldPath));
const b = splitScript(read(newPath));

const skelChanged = skeleton(a.markup) !== skeleton(b.markup);
const logicChanged = scriptLogic(a.script) !== scriptLogic(b.script);
const textChanged = visibleText(a.markup) !== visibleText(b.markup);
const dataChanged = scriptData(a.script) !== scriptData(b.script);

function lineDiff(x, y, limit = 40) {
  const xs = new Set(x.split('\n'));
  const ys = new Set(y.split('\n'));
  const removed = [...xs].filter(l => !ys.has(l));
  const added = [...ys].filter(l => !xs.has(l));
  return { removed: removed.slice(0, limit), added: added.slice(0, limit) };
}

let verdict, code;
if (skelChanged || logicChanged) {
  verdict = 'STRUCTURAL';
  code = 2;
} else if (textChanged || dataChanged) {
  verdict = 'CONTENT';
  code = 1;
} else {
  verdict = 'IDENTICAL';
  code = 0;
}

console.log(`VERDICT=${verdict}`);
console.log(`markup_structure_changed=${skelChanged}`);
console.log(`dclogic_logic_changed=${logicChanged}`);
console.log(`visible_text_changed=${textChanged}`);
console.log(`dclogic_data_changed=${dataChanged}`);

if (textChanged) {
  const d = lineDiff(visibleText(a.markup), visibleText(b.markup));
  console.log('\n--- copy removed ---');
  d.removed.forEach(l => console.log('  - ' + l.slice(0, 160)));
  console.log('--- copy added ---');
  d.added.forEach(l => console.log('  + ' + l.slice(0, 160)));
}

if (skelChanged) {
  const d = lineDiff(skeleton(a.markup), skeleton(b.markup), 25);
  console.log('\n--- structure removed ---');
  d.removed.forEach(l => console.log('  - ' + l.slice(0, 200)));
  console.log('--- structure added ---');
  d.added.forEach(l => console.log('  + ' + l.slice(0, 200)));
}

if (logicChanged) {
  const d = lineDiff(scriptLogic(a.script), scriptLogic(b.script), 25);
  console.log('\n--- DCLogic removed ---');
  d.removed.forEach(l => console.log('  - ' + l.trim().slice(0, 200)));
  console.log('--- DCLogic added ---');
  d.added.forEach(l => console.log('  + ' + l.trim().slice(0, 200)));
}

if (dataChanged) {
  const d = lineDiff(scriptData(a.script), scriptData(b.script));
  console.log('\n--- data removed ---');
  d.removed.forEach(l => console.log('  - ' + l.trim().slice(0, 160)));
  console.log('--- data added ---');
  d.added.forEach(l => console.log('  + ' + l.trim().slice(0, 160)));
}

process.exit(code);
