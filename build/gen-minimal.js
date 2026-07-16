#!/usr/bin/env node
// gen-minimal.js <out.html>
// Compiles "NED Labs Minimal.dc.html" (the minimalist page) into static HTML.
// Mirrors its renderVals(): the team reorders on window.innerWidth < 720, so
// both orderings are emitted and toggled by a media query (.ned-wide/.ned-narrow).
'use strict';
const fs = require('fs');
const path = require('path');

// The "no logos" design lists institutions as a gold dot + name, no favicons.
const institutions = [
  'Harvard Medical School', 'Weill Cornell', 'UCLA', 'Tel Aviv University',
  'Cedars-Sinai', 'Boston College', 'Sourasky Medical Center', 'Shamir Medical Center',
  'MD Anderson Cancer Center', 'Hebrew University', 'Davidoff Cancer Center', 'Massachusetts General Hospital'
];
const instItems = institutions.map(name => ({ name }));

const raw = [
  ['Prof. Giulio Draetta, MD', 'https://www.linkedin.com/in/giulio-draetta-5174755', 'https://scholar.google.com/citations?user=H0esp7EAAAAJ', null],
  ['Prof. Matthew Rosen', 'https://www.linkedin.com/in/matthew-rosen-a1899838', 'https://scholar.google.com/citations?user=JrcqHSMAAAAJ', null],
  ['Dr. Ari Raphael, MD', 'https://il.linkedin.com/in/ari-raphael-m-d-oncologist-scientist-09877994', 'https://scholar.google.com/citations?user=CQdAIAcAAAAJ', null],
  ['Prof. Steve Cole', 'https://www.linkedin.com/in/stevewcole', 'https://scholar.google.com/citations?user=tXaMqeYAAAAJ', null],
  ['Prof. Noam Shomron', 'https://il.linkedin.com/in/nshomron', 'https://scholar.google.com/citations?user=BdJzVV4AAAAJ', null],
  ['Einav Itamar', 'https://il.linkedin.com/in/1itamar', null],
  ['Eran Glicksman', 'https://il.linkedin.com/in/glix', null],
  ['Dr. Itay Ricon', 'https://www.linkedin.com/in/itay-ricon-becker', 'https://scholar.google.com/citations?user=yeY7eeYAAAAJ', null],
  ['Ofir Avnion', 'https://il.linkedin.com/in/ofir-avnion-787a78202', null],
  ['Ori Engel', 'https://il.linkedin.com/in/ori-engel-ab435a2b8', null],
  ['Peleg Margules', 'https://www.linkedin.com/in/peleg-margules/', null],
  ['Shay Liraz', 'https://il.linkedin.com/in/shay-liraz', null],
  ['Dr. Tomer Landsberger', 'https://www.linkedin.com/in/tomer-landsberger-48127393', 'https://scholar.google.com/citations?user=wswTSOoAAAAJ', null],
  ['Avinoam Lavi', 'https://il.linkedin.com/in/avinoam-lichtenstadt', null],
  ['Guy Houri', 'https://il.linkedin.com/in/guy-houri', null],
  ['Dr. Yuval David, MD', 'https://il.linkedin.com/in/yuval-david-md-5b5b91280', null],
  ['Dr. Tomas Duraj, MD-PhD', 'https://www.linkedin.com/in/tomasduraj', 'https://scholar.google.com/citations?user=yJWmhBkAAAAJ', null],
  ['Daniel Orrego', 'https://www.linkedin.com/in/orrego', null],
  ['Mark Popov', 'https://il.linkedin.com/in/mark-popov-92759b77', null],
  ['Dr. Daniel Barazany', 'https://www.linkedin.com/in/daniel-barazany-4991248a/', null]
];

const titled = raw.filter(([n]) => /^(Prof\.|Dr\.)/.test(n));
const untitled = raw.filter(([n]) => !/^(Prof\.|Dr\.)/.test(n)).sort((a, b) => a[0].localeCompare(b[0]));
const half = Math.ceil(raw.length / 2);
const colA = [];
const colB = [];
titled.forEach((p, i) => (i % 2 === 0 ? colA : colB).push(p));
untitled.forEach(p => (colA.length < half ? colA : colB).push(p));
const orderedWide = colA.concat(colB);
const orderedNarrow = titled.concat(untitled);

const toMember = ([name, li, gs, web]) => ({ name, li, gs, web, hasLi: !!li, hasGs: !!gs, hasWeb: !!web });
const teamWide = orderedWide.map(toMember);
const teamNarrow = orderedNarrow.map(toMember);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GS = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 1 9l4.5 2.45v4.1c0 .5.28.97.73 1.2L12 20l5.77-3.25c.45-.23.73-.7.73-1.2v-4.1L21 10.1V16h1.5V9.35L12 3zm5 12.4-5 2.82-5-2.82v-2.9l5 2.72 5-2.72v2.9z"></path></svg>';
const LI = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.24 8.31h4.52V23H.24V8.31zM8.34 8.31h4.33v2h.06c.6-1.14 2.08-2.34 4.28-2.34 4.58 0 5.42 3.01 5.42 6.92V23h-4.51v-7.11c0-1.7-.03-3.88-2.37-3.88-2.37 0-2.73 1.85-2.73 3.76V23H8.34V8.31z"></path></svg>';
const WEB = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><ellipse cx="12" cy="12" rx="4" ry="9"></ellipse><path d="M3.6 9h16.8M3.6 15h16.8"></path></svg>';
const ICON = 'display:flex;align-items:center;color:rgba(35,35,33,0.32);text-decoration:none';

const renderTeam = team => team.map(m => {
  const links = [
    m.hasGs ? `<a href="${esc(m.gs)}" target="_blank" rel="noopener" title="Google Scholar" aria-label="${esc(m.name)} on Google Scholar" style="${ICON}">${GS}</a>` : '',
    m.hasLi ? `<a href="${esc(m.li)}" target="_blank" rel="noopener" title="LinkedIn" aria-label="${esc(m.name)} on LinkedIn" style="${ICON}">${LI}</a>` : '',
    m.hasWeb ? `<a href="${esc(m.web)}" target="_blank" rel="noopener" title="Website" aria-label="${esc(m.name)} website" style="${ICON}">${WEB}</a>` : ''
  ].filter(Boolean).join('\n            ');
  return `        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;break-inside:avoid">
          <div style="flex:1;font-size:15px;font-weight:600;color:#232321">${esc(m.name)}</div>
          <div style="display:flex;gap:6px;flex:none">
            ${links}
          </div>
        </div>`;
}).join('\n');

const instHtml = instItems.map(i => `      <div style="display:flex;align-items:center;gap:11px;padding:8px 0">
        <div style="width:6px;height:6px;border-radius:50%;flex:none;background:#d9b36a"></div>
        <div style="font-size:15px;font-weight:600;color:#232321">${esc(i.name)}</div>
      </div>`).join('\n');

const tpl = fs.readFileSync(path.join(__dirname, 'template-minimal.html'), 'utf8');
const out = process.argv[2];
let html = tpl
  .replace('<!--INST-->', instHtml)
  .replace('<!--TEAM_WIDE-->', renderTeam(teamWide))
  .replace('<!--TEAM_NARROW-->', renderTeam(teamNarrow));

for (const ph of ['<!--INST-->', '<!--TEAM_WIDE-->', '<!--TEAM_NARROW-->']) {
  if (html.includes(ph)) throw new Error('placeholder not replaced: ' + ph);
}
if (/sc-for|sc-if|\{\{|x-dc|hint-placeholder|helmet|style-hover/.test(html)) throw new Error('template syntax survived into output');
if (!/width=device-width/.test(html)) throw new Error('viewport must be device-width');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${html.length} bytes), team wide=${teamWide.length} narrow=${teamNarrow.length}, institutions=${instItems.length}`);
