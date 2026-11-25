// QR Code Manager checks. Run with:  npm test   (or: node tests/run.js)
// The page is opened in its preview mode with made-up codes, so nothing real is read or changed.
// The run fails (exit code 1) if any check fails.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const { open, ROOT, backJs } = require('./harness');

const results = [];
const only = process.argv.slice(2);
async function check(name, fn) {
  if (only.length && !only.some(o => name.toLowerCase().includes(o.toLowerCase()))) return;
  try { await fn(); results.push({ name, ok: true }); console.log('  PASS  ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('  FAIL  ' + name + '\n        ' + String(e.message).split('\n').join('\n        ')); }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }
const noErrors = errs => expect(!errs.length, 'Page errors:\n' + errs.join('\n'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

(async () => {
  const browser = await chromium.launch();
  const opts = o => Object.assign({ browser }, o || {});
  const page = p => p.evaluate(() => (document.querySelector('nav button[data-hq][aria-current]') || {}).dataset?.hq || '');
  const panelOpen = p => p.evaluate(() => document.getElementById('panel').classList.contains('on'));
  const back = async p => { await p.evaluate(() => history.back()); await p.waitForTimeout(700); };
  const fwd = async p => { await p.evaluate(() => history.forward()); await p.waitForTimeout(700); };
  const menu = async (p, name) => { await p.click('nav button[data-hq="' + name + '"]'); await p.waitForTimeout(400); };

  /* 1. Every script in the page reads as valid JavaScript */
  await check('Every page script parses', async () => {
    const bad = []; const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g; let m, i = 0;
    while ((m = re.exec(html))) { i++; try { new vm.Script(m[2], { filename: 'index.html script ' + i }); } catch (e) { bad.push('script ' + i + ': ' + e.message); } }
    expect(!bad.length, bad.join('\n'));
  });

  /* 2. The opening page and the overview draw with no page errors */
  await check('Opens on Overview with no page errors', async () => {
    const t = await open(opts());
    expect(await page(t.page) === 'overview', 'opened on ' + await page(t.page));
    noErrors(t.errs); await t.close();
  });

  /* 3. Back and Forward (CN-033): the shared /assets/back.js, loaded right after session.js,
        never copied, and nothing of our own changes the browser's history */
  await check('Back: the shared helper is loaded once, right after the sign-in line', async () => {
    const tags = html.match(/<script src="\/assets\/back\.js"><\/script>/g) || [];
    expect(tags.length === 1, 'expected one back.js line, found ' + tags.length);
    const head = html.slice(0, html.indexOf('</head>'));
    const ses = head.indexOf('/assets/session.js'), bk = head.indexOf('<script src="/assets/back.js">');
    expect(ses > 0 && bk > ses && !/<script[\s>]/.test(head.slice(head.indexOf('</script>', ses) + 9, bk)), 'back.js must come straight after the session.js script in <head>');
    expect(!/pushState/.test(html), 'the page must not call history.pushState itself');
    expect(!fs.readdirSync(ROOT).some(f => /^back\.js$/i.test(f)), 'back.js must not be copied into this repository');
    expect((await backJs()).includes('MismoBack'), 'the live https://resources.mismo.org/assets/back.js did not load');
  });

  await check('Back: menu pages, Forward, the code panel, and a panel closed with its X', async () => {
    const t = await open(opts()), p = t.page;
    expect(await page(p) === 'overview', 'should open on Overview');
    await menu(p, 'codes'); await menu(p, 'scans');
    await back(p); expect(await page(p) === 'codes', 'Back from Scan Activity should return to All Codes, got ' + await page(p));
    await fwd(p); expect(await page(p) === 'scans', 'Forward should go to Scan Activity again, got ' + await page(p));
    await back(p); expect(await page(p) === 'codes', 'Back again should be All Codes');
    await p.click('#view .hqrow[data-open]'); await p.waitForTimeout(400);
    expect(await panelOpen(p), 'clicking a code should open its panel');
    await back(p);
    expect(!await panelOpen(p), 'Back should close the code panel');
    expect(await page(p) === 'codes', 'Back should stay on All Codes when it closes the panel, got ' + await page(p));
    await p.click('#view .hqrow[data-open]'); await p.waitForTimeout(400);
    expect(await panelOpen(p), 'the panel should open again');
    await p.click('#panel-x'); await p.waitForTimeout(500);
    expect(!await panelOpen(p), 'the X should close the panel');
    await back(p);
    expect(await page(p) === 'overview', 'after closing the panel with its X, Back should go straight to the page before (Overview), got ' + await page(p));
    expect(!await panelOpen(p), 'the panel should stay shut');
    expect(!/[?]/.test(p.url()), 'the address should not gain anything');
    noErrors(t.errs); await t.close();
  });

  await check('Back: on a phone, Back closes the open menu drawer first', async () => {
    const t = await open(opts({ w: 390, h: 800 })), p = t.page;
    await menu(p, 'codes');
    await p.click('#rail-hide'); await p.waitForTimeout(400);
    const drawer = () => p.evaluate(() => !document.body.classList.contains('railmini'));
    expect(await drawer(), 'the menu should open');
    await back(p);
    expect(!await drawer(), 'Back should close the menu drawer');
    expect(await page(p) === 'codes', 'and stay on All Codes, got ' + await page(p));
    await back(p);
    expect(await page(p) === 'overview', 'Back again should go to Overview, got ' + await page(p));
    noErrors(t.errs); await t.close();
  });

  /* 4. Someone scanning a code still lands on the scan page with no errors */
  await check('A scan (?c=) still works with the Back helper loaded', async () => {
    const t = await open(opts({ hash: '?c=BGLOSS' }));
    noErrors(t.errs); await t.close();
  });

  await browser.close();
  const bad = results.filter(r => !r.ok);
  console.log('\n' + (results.length - bad.length) + ' of ' + results.length + ' checks passed.');
  process.exit(bad.length ? 1 : 0);
})();
