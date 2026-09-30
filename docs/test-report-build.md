# Report source and rebuild

`test-plan-report.md` is the report text. `test-report-assets/manifest.json`
defines the evidence order, source filenames, captions and SHA-256 hashes.
The builder verifies that the images are unchanged, then generates
`test-plan-report.html`, `test-plan-report.pdf` and `test-plan-report.tex`.
The supplied PDF is rendered from HTML with WeasyPrint; LaTeX is an alternate
editable export of the same text and evidence, with potentially different pagination.

From the repository root:

```bash
.venv-test-report/bin/pip install weasyprint==70.0 markdown==3.11 pypandoc_binary==1.17
.venv-test-report/bin/python scripts/build-test-report.py
```

WeasyPrint requires system Pango/font libraries. The build was checked on the
local Linux laptop. To compile the alternate LaTeX source, use a LaTeX installation
with Pandoc's standard packages, `graphicx`, `pdflscape` and `xurl`, running from
`docs/`. The delivered PDF does not require a LaTeX installation.

## Playwright UI evidence

The browser tests are separate from web `npm test` utility tests:

```bash
.venv-test-report/bin/pip install playwright==1.63.0
npm --prefix apps/web run dev -- --hostname 127.0.0.1 --port 3107
# In a second terminal (requires an installed Google Chrome browser):
.venv-test-report/bin/python -m pytest tests/ui/test_web_ui.py -v \
  --junitxml=runs/test-evidence/playwright-ui/results.xml
```

Set `FRESHLENS_UI_URL` for another local server, and `FRESHLENS_UI_OUTPUT` for
a new evidence directory. Tests require configured public Supabase settings
so the real login controls are enabled, but use no real credentials and do not
perform a successful sign-in. Every test gets a fresh browser context.

The archived run passed eight tests in 12.79 seconds using Playwright 1.63.0,
Chrome 153.0.8010.47 and Next.js 16.2.12. Its log and JUnit XML are copied to
`test-report-assets/`. The main report precisely lists its browser scope.
The original nineteen terminal PNGs and two selected browser PNGs are copied
unchanged into that directory; none of the terminal output has been edited.
