#!/usr/bin/env python3
"""Regenerate search-index.json from the site's HTML pages.

Run this after editing any indexed page's text, then commit search-index.json
alongside the change. Article pages (which have <h2 id="..."> Objection/Reply
headings) are indexed section-by-section so search results can link straight
to the relevant heading; other prose pages are indexed as a single entry.
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent

# (filename, section_split) — section_split=True indexes each <h2 id="..."> block
# separately; False indexes the whole page's <main> as one entry.
PAGES = [
    ("note-to-reader.html", False),
    ("article-1.html", True),
    ("article-2.html", True),
    ("article-3.html", True),
    ("article-4.html", True),
    ("article-5.html", True),
    ("article-6.html", True),
    ("article-7.html", True),
    ("conclusion.html", False),
    ("appendix-a.html", False),
]

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.S)
MAIN_RE = re.compile(r"<main[^>]*>(.*?)</main>", re.S)
H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
H2_SPLIT_RE = re.compile(r'<h2[^>]*\bid="([^"]*)"[^>]*>(.*?)</h2>', re.S)


def strip_tags(fragment):
    return WS_RE.sub(" ", html.unescape(TAG_RE.sub(" ", fragment))).strip()


def page_title(raw_html):
    m = TITLE_RE.search(raw_html)
    return html.unescape(m.group(1)).strip() if m else ""


def display_title(main_html, fallback):
    h1s = H1_RE.findall(main_html)
    if len(h1s) >= 2:
        return strip_tags(h1s[1])  # article pages: [0]="Article N", [1]=real title
    if len(h1s) == 1:
        return strip_tags(h1s[0])
    return fallback


def build_entries(filename, split_sections):
    raw = (ROOT / filename).read_text(encoding="utf-8")
    fallback_title = page_title(raw)
    m = MAIN_RE.search(raw)
    if not m:
        return []
    main_html = m.group(1)
    fn_idx = main_html.find('<section class="footnotes"')
    if fn_idx != -1:
        main_html = main_html[:fn_idx]
    title = display_title(main_html, fallback_title)

    entries = []
    if not split_sections:
        text = strip_tags(main_html)
        if text:
            entries.append({"url": filename, "page": title, "heading": None, "text": text})
        return entries

    parts = H2_SPLIT_RE.split(main_html)
    intro_text = strip_tags(parts[0])
    if intro_text:
        entries.append({"url": filename, "page": title, "heading": None, "text": intro_text})
    for i in range(1, len(parts), 3):
        anchor, heading_html, body_html = parts[i], parts[i + 1], parts[i + 2]
        heading = strip_tags(heading_html)
        text = strip_tags(body_html)
        if not text:
            continue
        entries.append({"url": f"{filename}#{anchor}", "page": title, "heading": heading, "text": text})
    return entries


def main():
    all_entries = []
    for filename, split_sections in PAGES:
        all_entries.extend(build_entries(filename, split_sections))
    out = ROOT / "search-index.json"
    out.write_text(json.dumps(all_entries, ensure_ascii=False), encoding="utf-8")
    print(f"Indexed {len(all_entries)} entries from {len(PAGES)} pages -> {out.name}")


if __name__ == "__main__":
    main()
