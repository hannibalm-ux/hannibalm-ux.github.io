// Runs the Pixel Town test suite in headless Chromium, one fresh town per test.
//   npm i playwright   (or use a global install)   then:   node tests/run_tests.js [J1 C4 E10 ...]
// Set CHROMIUM=/path/to/chromium to use a specific browser binary.
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const page = 'file://' + path.resolve(__dirname, '..', 'pixel_town.html');
  const tests = path.resolve(__dirname, 'pixel_town.tests.js');
  const only = process.argv.slice(2);
  const browser = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
  const open = async () => { const ctx = await browser.newContext(); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(page); await p.waitForFunction(() => window.PT && PT.S); await p.addScriptTag({path: tests});
    const go = await p.$('#ovGo'); if (go) await go.click(); return {ctx, p, errs}; };
  const first = await open(); const list = (await first.p.evaluate(() => PTTests.list())).filter(t => !only.length || only.includes(t.id)); await first.ctx.close();
  let pass = 0, fail = 0;
  for (const t of list) {
    const {ctx, p, errs} = await open();
    const [r] = await p.evaluate(id => PTTests.run(id), t.id);
    if (errs.length && r.pass) { r.pass = false; r.error = 'page error: ' + errs[0]; }
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id.padEnd(4)} ${r.name}${r.pass ? ` (${r.ms} ms)` : `\n       ${r.error}\n       ${r.stack || ''}`}`);
    r.pass ? pass++ : fail++; await ctx.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); await browser.close(); process.exit(fail ? 1 : 0);
})();
