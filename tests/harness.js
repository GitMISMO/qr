// Opens the QR Code Manager in a headless browser in its preview mode (made-up sample codes,
// kept in the browser's own storage), so it can be checked without touching MISMO's data.
// Nothing here reaches MISMO except reading the live shared Back helper (/assets/back.js).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

async function open(opts = {}) {
  const browser = opts.browser || await chromium.launch();
  const page = await browser.newPage({ viewport: { width: opts.w || 1440, height: opts.h || 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', async r => {
    const u = r.request().url();
    if (u.includes('/assets/back.js')) return r.fulfill({ contentType: 'application/javascript', body: await backJs() });
    if (u.startsWith('http://qr.test/qr/')) return r.fulfill({ body: fs.readFileSync(path.join(ROOT, 'index.html')), contentType: 'text/html' });
    if (u.startsWith('http://qr.test')) return r.fulfill({ status: 404, body: '' });
    return r.abort();
  });
  await page.goto('http://qr.test/qr/' + (opts.hash || ''));
  await page.waitForTimeout(opts.settle || 1500);
  return { browser, page, errs, close: () => opts.browser ? page.close() : browser.close() };
}

/* The shared Back-button helper (resources.mismo.org/assets/back.js) is tested as it is live:
   MISMO_BACK can point at a local copy instead (for trying a change before it is published). */
let BACK = null;
async function backJs() {
  if (BACK !== null) return BACK;
  try {
    if (process.env.MISMO_BACK) BACK = fs.readFileSync(process.env.MISMO_BACK, 'utf8');
    else { const r = await fetch('https://resources.mismo.org/assets/back.js'); BACK = r.ok ? await r.text() : ''; }
  } catch (e) { BACK = ''; }
  return BACK;
}

module.exports = { open, ROOT, backJs };
