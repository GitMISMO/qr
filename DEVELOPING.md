# Developing the QR Code Manager

- The whole tool is `index.html`. It is live at resources.mismo.org/qr/ straight from `main`
  (GitHub Pages), so **pushing to main is going live**. Run the checks first.
- Off resources.mismo.org (a local copy, the checks) it opens in **preview mode** with made-up
  codes kept in the browser, and never signs in or saves anything real.

## Checks

    npm install
    npx playwright install chromium
    npm test

`tests/run.js` opens the page in a headless browser (`tests/harness.js`) and checks that the
scripts parse, the page opens with no errors, a scan link (`?c=`) still works, and the browser's
Back button (below). The same checks run in GitHub Actions on every push (`.github/workflows/checks.yml`).

## The browser's Back button (CN-033)

- `<head>` loads the shared `/assets/back.js` right after the `/assets/session.js` line. It is
  owned by Forms and shared pages: never copy it here, and never call `history.pushState` for this.
  The harness serves the live copy (set `MISMO_BACK=<file>` to try a local one).
- Each left-menu page (`nav button[data-hq]`, marked with `aria-current` by `go()`) is a history
  step. No menu button is marked in the HTML itself, so the helper waits until the app has opened.
- Layers Back closes, registered bottom first next to the rail code: the menu drawer on a narrow
  screen (closes like a click on its scrim), then the code panel (`closePanel()`, the same as its X).
  A new panel, pop-up or drawer must be registered there too, with `MismoBack.layer({ isOpen, close })`.

## The masthead (CN-053)

- It is Certification Management's masthead, to the pixel: a 68px navy bar (`--hq-h`), padding `0 22px`, 14px gaps,
  logo box `9px 13px` with 5px corners, logo 24px tall, a 1px divider 42px tall, the name at 16px / 500 / `#94c8e9`.
  At 560px and under it shrinks exactly as Certification Management's does (a 55px bar). The left menu and the
  scan page take their top from `--hq-h`, so change the height there only.
- No December hat in this page: the shared `/assets/holiday.js` (loaded by session.js) draws it.
