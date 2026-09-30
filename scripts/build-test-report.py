#!/usr/bin/env python3
"""Build the dated report from Markdown and byte-preserved evidence images."""
from html import escape
import hashlib
import json
from pathlib import Path

import markdown
import pypandoc
from weasyprint import HTML

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
ASSETS = DOCS / "test-report-assets"

CSS = """
@page {
  size: A4; margin: 19mm 20mm 20mm;
  @top-right { content: 'FreshLens · Test Plan Report'; font: 8pt 'Liberation Sans'; color: #60706a; }
  @bottom-left { content: 'CS3203 · Group 21 · PID 5'; font: 8pt 'Liberation Sans'; color: #60706a; }
  @bottom-right { content: counter(page); font: 8pt 'Liberation Sans'; color: #60706a; }
}
@page cover { @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
@page evidence { size: A4 landscape; margin: 12mm 12mm 13mm; @top-right { content: none; } }
@page portrait-evidence { size: A4; margin: 15mm 18mm 18mm; @top-right { content: none; } }
body { font: 10.5pt/1.36 'Liberation Serif', serif; color: #172620; }
h1, h2, h3 { font-family: 'Liberation Sans', sans-serif; color: #12503d; break-after: avoid; }
h1 { font-size: 20pt; line-height: 1.18; margin: 0 0 6mm; break-before: page; }
h2 { font-size: 12.5pt; margin: 5mm 0 2.5mm; }
p { margin: 0 0 3mm; orphans: 3; widows: 3; }
table { border-collapse: collapse; width: 100%; margin: 3mm 0 4mm; font: 8.8pt/1.25 'Liberation Sans'; table-layout: auto; }
th { background: #174e3e; color: white; font-weight: bold; text-align: left; }
td, th { padding: 1.6mm 2mm; border-bottom: 0.3mm solid #d6e2dc; vertical-align: top; overflow-wrap: anywhere; }
tr:nth-child(even) td { background: #f2f6f3; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
code { font: 8.6pt 'Liberation Mono'; overflow-wrap: anywhere; }
pre { background: #f2f6f3; border-left: 1mm solid #24755a; padding: 4mm; white-space: pre-wrap; overflow-wrap: anywhere; break-inside: avoid; }
pre code { font-size: 8pt; line-height: 1.4; }
a { color: #12503d; text-decoration: none; }
li { margin-bottom: 2mm; }
.cover { page: cover; break-after: page; padding-top: 28mm; }
.cover .eyebrow { font: bold 10pt 'Liberation Sans'; letter-spacing: 2px; color: #39765d; }
.cover .brand { font: bold 47pt 'Liberation Sans'; margin: 12mm 0 6mm; color: #12503d; }
.cover .subtitle { font: 19pt/1.35 'Liberation Sans'; max-width: 150mm; }
.cover .report-name { font: bold 26pt 'Liberation Sans'; margin-top: 22mm; padding-top: 8mm; border-top: 1mm solid #12503d; }
.cover .metadata { font: 12pt/1.8 'Liberation Sans'; margin-top: 19mm; }
.cover .note { margin-top: 19mm; font: 10pt/1.5 'Liberation Sans'; color: #52665b; }
.contents { break-after: page; }
.contents h1 { break-before: auto; }
.contents ul { list-style: none; padding-left: 0; }
.contents ul ul { padding-left: 5mm; font-size: 9pt; }
.contents li { margin: 1.4mm 0; }
.contents > ul > li { margin-bottom: 3mm; font-weight: bold; }
.contents ul ul li { font-weight: normal; }
.contents a::after { content: leader('.') target-counter(attr(href), page); }
.evidence { page: evidence; break-before: page; break-after: page; }
.evidence h2 { margin: 0 0 4mm; font-size: 15pt; }
.evidence img { display: block; max-width: 100%; max-height: 146mm; width: auto; height: auto; margin: 0 auto 3mm; }
.evidence p { font: 9.5pt/1.35 'Liberation Sans'; margin: 2mm 0; }
.evidence .source { font-size: 8pt; color: #52665b; }
.evidence.portrait { page: portrait-evidence; }
.evidence.portrait img { max-height: 194mm; }
"""


def main():
    source = (DOCS / "test-plan-report.md").read_text()
    evidence = json.loads((ASSETS / "manifest.json").read_text())
    for item in evidence:
        image = ASSETS / item["file"]
        assert hashlib.sha256(image.read_bytes()).hexdigest() == item["sha256"], image

    md = markdown.Markdown(extensions=["tables", "fenced_code", "toc"],
                           extension_configs={"toc": {"toc_depth": 1}})
    body = md.convert(source.replace("<!-- EVIDENCE_APPENDIX -->", ""))
    figures = []
    tex_figures = []
    for item in evidence:
        portrait = item["id"] == "E21"
        title = f'{item["id"]} — {item["title"]}'
        figures.append(
            f'<section class="evidence{" portrait" if portrait else ""}" id="{item["id"]}">'
            f'<h2>{escape(title)}</h2>'
            f'<img src="test-report-assets/{item["file"]}" alt="{escape(item["title"])}">'
            f'<p><strong>{item["id"]}.</strong> {escape(item["caption"])}</p>'
            f'<p class="source">Source: {escape(item["source"])} · {escape(item["origin"])}</p></section>'
        )
        tex_title = pypandoc.convert_text(title, "latex", format="markdown").strip()
        tex_caption = pypandoc.convert_text(item["caption"], "latex", format="markdown").strip()
        tex_source = pypandoc.convert_text(item["source"], "latex", format="markdown").strip()
        tex_figures.append(
            "\\clearpage\n" + ("" if portrait else "\\begin{landscape}\n")
            + "\\subsection*{" + tex_title + "}\n\\begin{center}\n"
            + "\\includegraphics[width=\\linewidth,height=" + ("0.68" if portrait else "0.70")
            + "\\textheight,keepaspectratio]{test-report-assets/" + item["file"] + "}\n\\end{center}\n"
            + tex_caption + "\n\n{\\small Source: " + tex_source + "}\n"
            + ("" if portrait else "\\end{landscape}\n")
        )
    cover = """<section class="cover">
      <p class="eyebrow">CS3203 · GROUP 21 · PID 5</p>
      <p class="brand">FreshLens</p>
      <p class="subtitle">AI-Powered Freshness Monitoring System<br>for Small-Scale Retailers</p>
      <p class="report-name">Test Plan Report</p>
      <p class="metadata">Execution results and screenshot evidence<br>27 September 2026</p>
      <p class="note">Unit · API · database security · service integration<br>Playwright browser UI · Grafana k6 performance</p>
    </section>"""
    html = ("<!doctype html><html lang='en'><head><meta charset='utf-8'>"
            "<title>FreshLens — Test Plan Report</title><meta name='author' content='CS3203 Group 21, PID 5'>"
            f"<style>{CSS}</style></head><body>{cover}"
            f'<section class="contents"><h1>Contents</h1>{md.toc}</section>'
            + body + "".join(figures) + "</body></html>")
    (DOCS / "test-plan-report.html").write_text(html)
    HTML(string=html, base_url=str(DOCS)).write_pdf(DOCS / "test-plan-report.pdf")

    header = DOCS / "test-report-assets" / "latex-header.tex"
    header.write_text("\\usepackage{pdflscape}\n\\usepackage{graphicx}\n"
                      "\\usepackage{xurl}\n\\setlength{\\emergencystretch}{3em}\n")
    tex = pypandoc.convert_text(
        source.replace("<!-- EVIDENCE_APPENDIX -->", "\n".join(tex_figures)),
        "latex", format="markdown+raw_tex", extra_args=["--standalone", "--toc",
        "--toc-depth=1", "-V", "geometry:margin=20mm", "-V", "fontsize:11pt",
        "-M", "title=FreshLens: Test Plan Report", "-M", "author=CS3203 Group 21 — PID 5",
        "-M", "date=27 September 2026", "--include-in-header=" + str(header)],
    )
    (DOCS / "test-plan-report.tex").write_text(tex)
    print(f"Built PDF, HTML and LaTeX with {len(evidence)} verified evidence images.")


if __name__ == "__main__":
    main()
