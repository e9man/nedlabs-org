// Compiles the DesignSync .dc.html component into static HTML.
// Mirrors renderVals() from the <script type="text/x-dc"> block.
//
// The component reorders the team list on window.innerWidth < 720 and swaps the
// timeline arrow between horizontal and vertical. Static HTML has no runtime, so
// both variants are emitted and toggled by a media query at the same breakpoint.
const fs = require('fs');
const path = require('path');

const raw = [
  ["Prof. Giulio Draetta, MD", "https://www.linkedin.com/in/giulio-draetta-5174755", "https://scholar.google.com/citations?user=H0esp7EAAAAJ"],
  ["Dr. Mitchell A Kline, MD", "https://www.linkedin.com/in/mitchell-a-kline-md-803a7017", "https://scholar.google.com/citations?user=wj2OiuYAAAAJ"],
  ["Prof. Matthew Rosen", "https://www.linkedin.com/in/matthew-rosen-a1899838", "https://scholar.google.com/citations?user=JrcqHSMAAAAJ"],
  ["Dr. Ari Raphael, MD", "https://il.linkedin.com/in/ari-raphael-m-d-oncologist-scientist-09877994", "https://scholar.google.com/citations?user=CQdAIAcAAAAJ"],
  ["Dr. Barliz Waissengrin, MD", "https://www.linkedin.com/in/dr-barliz-waissengrin-74539710", "https://scholar.google.com/citations?user=eCq1wugAAAAJ"],
  ["Prof. Steve Cole", "https://www.linkedin.com/in/stevewcole", "https://scholar.google.com/citations?user=tXaMqeYAAAAJ"],
  ["Prof. Ben Corn, MD", null, null, "https://dailynews.ascopubs.org/do/dr-ben-corn-honored-humanitarian-award-decades-long-quest-integrate-hopefulness-into"],
  ["Prof. Deborah Blumenthal, MD", "https://il.linkedin.com/in/deborah-blumenthal-b383164", "https://scholar.google.com/citations?user=c_9bmTkAAAAJ"],
  ["Prof. Noam Shomron", "https://il.linkedin.com/in/nshomron", "https://scholar.google.com/citations?user=BdJzVV4AAAAJ"],
  ["Einav Itamar", "https://il.linkedin.com/in/1itamar", null],
  ["Eran Glicksman", "https://il.linkedin.com/in/glix", null],
  ["Dr. Itay Ricon", "https://www.linkedin.com/in/itay-ricon-becker", "https://scholar.google.com/citations?user=yeY7eeYAAAAJ"],
  ["Ofir Avnion", "https://il.linkedin.com/in/ofir-avnion-787a78202", null],
  ["Ori Engel", "https://il.linkedin.com/in/ori-engel-ab435a2b8", null],
  ["Peleg Margules", "https://www.linkedin.com/in/peleg-margules/", null],
  ["Shay Liraz", "https://il.linkedin.com/in/shay-liraz", null],
  ["Dr. Tomer Landsberger", "https://www.linkedin.com/in/tomer-landsberger-48127393", "https://scholar.google.com/citations?user=wswTSOoAAAAJ"],
  ["Avinoam Lavi", "https://il.linkedin.com/in/avinoam-lichtenstadt", null],
  ["Guy Houri", "https://il.linkedin.com/in/guy-houri", null],
  ["Dr. Yuval David, MD", "https://il.linkedin.com/in/yuval-david-md-5b5b91280", null],
  ["Dr. Tomas Duraj, MD-PhD", "https://www.linkedin.com/in/tomasduraj", "https://scholar.google.com/citations?user=yJWmhBkAAAAJ"],
  ["Daniel Orrego", "https://www.linkedin.com/in/orrego", null],
  ["Mark Popov", "https://il.linkedin.com/in/mark-popov-92759b77", null],
  ["Dr. Daniel Barazany", "https://www.linkedin.com/in/daniel-barazany-4991248a/", null]
];

const titled = raw.filter(([n]) => /^(Prof\.|Dr\.)/.test(n));
const untitled = raw.filter(([n]) => !/^(Prof\.|Dr\.)/.test(n)).sort((a, b) => a[0].localeCompare(b[0]));
const half = Math.ceil(raw.length / 2);
const colA = [];
const colB = [];
titled.forEach((p, i) => (i % 2 === 0 ? colA : colB).push(p));
untitled.forEach(p => (colA.length < half ? colA : colB).push(p));

const orderedWide = colA.concat(colB);       // narrow === false
const orderedNarrow = titled.concat(untitled); // narrow === true

const toMember = ([name, li, gsOverride, web]) => {
  const stripped = name.replace(/Prof\.|Dr\.|, MD(-PhD)?|MD/g, "").trim();
  let gs;
  if (gsOverride === null) gs = null;
  else if (gsOverride && gsOverride.startsWith("http")) gs = gsOverride;
  else gs = "https://scholar.google.com/citations?hl=en&view_op=search_authors&mauthors=" + encodeURIComponent(gsOverride || stripped);
  return { name, li, hasLi: !!li, gs, hasGs: !!gs, web, hasWeb: !!web };
};
const teamWide = orderedWide.map(toMember);
const teamNarrow = orderedNarrow.map(toMember);

const institutions = [
  [["Harvard Medical School", "hms.harvard.edu"], ["Weill Cornell", "weill.cornell.edu"], ["UCLA", "ucla.edu"], ["Tel Aviv University", "tau.ac.il"]],
  [["Cedars-Sinai", "cedars-sinai.org"], ["Hebrew University", "huji.ac.il"], ["Sourasky Medical Center", "tasmc.org.il"], ["Shamir Medical Center", "shamir.org"]],
  [["MD Anderson Cancer Center", "mdanderson.org"], ["Boston College", "bc.edu"], ["Massachusetts General Hospital", "massgeneral.org"], ["Davidoff Cancer Center", "hospitals.clalit.co.il", "assets/davidoff-logo.png"]]
];
const mono = name => name.split(" ").filter(w => /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join("");
const instRows = institutions.map(row => row.map(([name, domain, custom]) => ({
  name,
  mono: mono(name),
  // single-quoted url() so it survives inside a double-quoted style attribute
  logoBg: custom ? "url('" + custom + "')" : "url('https://www.google.com/s2/favicons?domain=" + domain + "&sz=64')"
})));

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const GS_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 1 9l4.5 2.45v4.1c0 .5.28.97.73 1.2L12 20l5.77-3.25c.45-.23.73-.7.73-1.2v-4.1L21 10.1V16h1.5V9.35L12 3zm5 12.4-5 2.82-5-2.82v-2.9l5 2.72 5-2.72v2.9z"></path></svg>';
const LI_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.24 8.31h4.52V23H.24V8.31zM8.34 8.31h4.33v2h.06c.6-1.14 2.08-2.34 4.28-2.34 4.58 0 5.42 3.01 5.42 6.92V23h-4.51v-7.11c0-1.7-.03-3.88-2.37-3.88-2.37 0-2.73 1.85-2.73 3.76V23H8.34V8.31z"></path></svg>';
const WEB_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><ellipse cx="12" cy="12" rx="4" ry="9"></ellipse><path d="M3.6 9h16.8M3.6 15h16.8"></path></svg>';
const ICON_STYLE = 'width:20px;height:20px;border:1px solid rgba(253,251,245,0.3);border-radius:4px;display:flex;align-items:center;justify-content:center;color:rgba(253,251,245,0.75);text-decoration:none';

const renderTeam = team => team.map(m => {
  const links = [
    m.hasGs ? `<a href="${esc(m.gs)}" target="_blank" rel="noopener" title="Google Scholar" aria-label="${esc(m.name)} on Google Scholar" style="${ICON_STYLE}">${GS_ICON}</a>` : '',
    m.hasLi ? `<a href="${esc(m.li)}" target="_blank" rel="noopener" title="LinkedIn" aria-label="${esc(m.name)} on LinkedIn" style="${ICON_STYLE}">${LI_ICON}</a>` : '',
    m.hasWeb ? `<a href="${esc(m.web)}" target="_blank" rel="noopener" title="Web" aria-label="${esc(m.name)} on the web" style="${ICON_STYLE}">${WEB_ICON}</a>` : ''
  ].filter(Boolean).join('\n            ');
  return `        <div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid rgba(253,251,245,0.16);break-inside:avoid">
          <div style="width:7px;height:7px;border-radius:50%;flex:none;background:#d9b36a"></div>
          <div style="flex:1;font-size:15px;font-weight:700;color:#fdfbf5">${esc(m.name)}</div>
          <div style="display:flex;gap:6px;flex:none">
            ${links}
          </div>
        </div>`;
}).join('\n');

const instHtml = instRows.map(row => {
  const cells = row.map(inst => `        <div style="display:flex;align-items:center;gap:11px;border:1px solid rgba(253,251,245,0.28);border-radius:8px;padding:10px 16px 10px 12px;font-size:14.5px;font-weight:600;color:rgba(253,251,245,0.9)">
          <div style="width:26px;height:26px;border-radius:5px;flex:none;position:relative;background:repeating-linear-gradient(45deg,rgba(253,251,245,0.18),rgba(253,251,245,0.18) 3px,rgba(253,251,245,0.08) 3px,rgba(253,251,245,0.08) 6px);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;letter-spacing:0.02em;color:rgba(253,251,245,0.75)">${esc(inst.mono)}<div style="position:absolute;inset:0;border-radius:5px;background-color:#fdfbf5;background-image:${inst.logoBg};background-size:18px 18px;background-position:center;background-repeat:no-repeat"></div></div>
          <div>${esc(inst.name)}</div>
        </div>`).join('\n');
  return `      <div style="display:flex;flex-wrap:wrap;gap:10px">\n${cells}\n      </div>`;
}).join('\n');

const tplPath = path.join(__dirname, 'template.html');
const outPath = process.argv[2];
let html = fs.readFileSync(tplPath, 'utf8');
html = html
  .replace('<!--TEAM_WIDE-->', renderTeam(teamWide))
  .replace('<!--TEAM_NARROW-->', renderTeam(teamNarrow))
  .replace('<!--INSTROWS-->', instHtml);

for (const ph of ['<!--TEAM_WIDE-->', '<!--TEAM_NARROW-->', '<!--INSTROWS-->']) {
  if (html.includes(ph)) throw new Error(`placeholder not replaced: ${ph}`);
}
if (/sc-for|sc-if|\{\{|x-dc|hint-placeholder|helmet/.test(html)) throw new Error('template syntax survived into output');
if (!/width=device-width/.test(html)) throw new Error('viewport must be device-width or mobile breaks');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${html.length} bytes)`);
console.log(`  team wide=${teamWide.length} narrow=${teamNarrow.length}, institutions=${instRows.flat().length}`);
console.log(`  wide[0]=${teamWide[0].name} | narrow[0]=${teamNarrow[0].name}`);
