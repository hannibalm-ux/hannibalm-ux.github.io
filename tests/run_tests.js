// Runs the Pixel Town test suites in headless Chromium, one fresh page per test.
//   npm i playwright   (or use a global install)   then:   node tests/run_tests.js [J1 C4 V3 ...]
// Set CHROMIUM=/path/to/chromium to use a specific browser binary.
// Two suites: the classic town (loaded with ?mode=classic) and the civilization mode (a new game, seeded per test).
const path = require('path');
const { chromium } = require('playwright');
const THREE_SRC = require('fs').readFileSync(path.resolve(__dirname, '..', 'vendor', 'three.module.min.js'), 'utf8');
const SUITES = [
  {file:'pixel_town.tests.js', global:'PTTests', query:() => '?mode=classic'},
  {file:'civ.tests.js',        global:'CivTests', query:t => `?seed=${t.seed||1234}`, three:true}
];
(async () => {
  const page = 'file://' + path.resolve(__dirname, '..', 'pixel_town.html');
  const only = process.argv.slice(2);
  const browser = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
  const open = async (suite, q) => { const ctx = await browser.newContext(); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(page + q); await p.waitForFunction(() => window.PT && PT.S); await p.addScriptTag({path: path.resolve(__dirname, suite.file)});
    // 3D model tests need three.js; file:// pages cannot import modules, so it is handed over as inline source
    if (suite.three) await p.evaluate(src => { const el = document.createElement('script'); el.type = 'text/plain'; el.id = 'three-src'; el.textContent = src; document.body.appendChild(el); }, THREE_SRC);
    const go = await p.$('#ovGo'); if (go) await go.click(); return {ctx, p, errs}; };
  let pass = 0, fail = 0;
  for (const suite of SUITES){
    const first = await open(suite, suite.query({})); const list = (await first.p.evaluate(g => window[g].list(), suite.global)).filter(t => !only.length || only.includes(t.id)); await first.ctx.close();
    for (const t of list) {
      const {ctx, p, errs} = await open(suite, suite.query(t));
      const [r] = await p.evaluate(([g, id]) => window[g].run(id), [suite.global, t.id]);
      if (errs.length && r.pass) { r.pass = false; r.error = 'page error: ' + errs[0]; }
      const civErrs = await p.evaluate(() => (typeof S!=='undefined' && S && S.civ && S.civ.errors) || []);
      if (civErrs.length && r.pass) { r.pass = false; r.error = `simulation error in ${civErrs[0].name}: ${civErrs[0].msg}`; r.stack = civErrs[0].stack; }
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id.padEnd(4)} ${r.name}${r.pass ? ` (${r.ms} ms)` : `\n       ${r.error}\n       ${r.stack || ''}`}`);
      r.pass ? pass++ : fail++; await ctx.close();
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
