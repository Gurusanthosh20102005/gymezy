#!/usr/bin/env python3
"""Render a page in a headless browser and check what static analysis cannot see.

Static linting cannot see horizontal overflow, clipped text, hidden-state bugs,
or the real colors behind CSS variables. This script loads the page, takes
screenshots, and measures the rendered result.

Usage:
  python render_check.py PAGE [--widths 320,768,1280] [--out ui-shots] [--dark]
                         [--select "#state=loading"] [--json]

  PAGE      an .html file, or an http(s):// / file:// URL (a local dev server works)
  --widths  comma-separated viewport widths (default 320,768,1280)
  --dark    also capture the widest width with prefers-color-scheme: dark
  --select  SELECTOR=VALUE; load the widest width, choose that <select> option and
            capture it (use to see loading / empty / error states). Repeatable.
  --out     folder for PNG screenshots (default ./ui-shots)

Measured for every capture:
  overflow     page-level horizontal overflow in px (must be 0)
  contrast     rendered text vs effective background (AA: 4.5:1, large text 3:1)
  targets      interactive elements smaller than 24x24 CSS px (WCAG 2.5.8)
  unnamed      buttons / links / inputs with no accessible name
  tiny text    rendered text under 12px

Needs:   pip install playwright   plus a Chromium: "playwright install chromium",
         or set CHROME_PATH to a Chrome/Chromium binary.
Exit:    0 = no problems, 1 = problems found, 2 = cannot run.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from pathlib import Path

CHECK_JS = r"""
() => {
  const out = { overflow: 0, contrast: [], small: [], unnamed: [], tiny: [], touch: 0 };
  const root = document.documentElement;
  out.overflow = root.scrollWidth - root.clientWidth;

  const parse = (c) => {
    const m = c && c.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some(isNaN)) return null;
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const blend = (f, b) => [0, 1, 2].map(i => f[i] * f[3] + b[i] * (1 - f[3])).concat([1]);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  const scheme = getComputedStyle(root).colorScheme || '';
  const canvas = (scheme.includes('dark') && !scheme.includes('light')) ? [18, 18, 18, 1] : [255, 255, 255, 1];

  const effectiveBg = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage !== 'none') return null;          // gradient or image: unknown
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; }
    }
    let base = canvas;
    for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base);
    return base;
  };
  const opacityOf = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
  const visible = (el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const desc = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id; else if (el.classList.length) s += '.' + el.classList[0];
    const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return t ? s + ' "' + t + '"' : s;
  };

  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION', 'OPTGROUP', 'HEAD', 'TITLE', 'META', 'LINK']);
  for (const el of document.querySelectorAll('body *')) {
    if (SKIP.has(el.tagName) || el.closest('svg') || el.closest(':disabled') || el.closest('[aria-disabled="true"]')) continue;
    const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    if (!hasText || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight) || 400;
    if (fs < 12) out.tiny.push(desc(el) + ' (' + fs + 'px)');
    const fg = parse(cs.color), bg = effectiveBg(el);
    if (!fg || !bg) continue;
    fg[3] *= opacityOf(el);
    const eff = blend(fg, bg);
    const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const need = large ? 3 : 4.5, got = ratio(eff, bg);
    if (got < need) out.contrast.push(desc(el) + ' ' + got.toFixed(2) + ':1 (needs ' + need + ')');
  }

  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=tab], [tabindex]:not([tabindex="-1"])';
  const nameOf = (el) => {
    const al = el.getAttribute('aria-label'); if (al && al.trim()) return al;
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const t = lb.split(/\s+/).map(id => (document.getElementById(id) || {}).textContent || '').join(' ').trim(); if (t) return t; }
    if (el.labels && el.labels.length) { const t = Array.from(el.labels).map(l => l.textContent).join(' ').trim(); if (t) return t; }
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (['button', 'submit', 'reset'].includes(type) && el.value) return el.value;
    const txt = (el.innerText || '').trim(); if (txt) return txt;
    if (el.querySelector('img[alt]:not([alt=""]), svg[aria-label], [role=img][aria-label]')) return 'img';
    const t = el.getAttribute('title'); return t && t.trim() ? t : '';
  };
  for (const el of document.querySelectorAll(sel)) {
    if (!visible(el) || el.closest(':disabled')) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const inlineLink = el.tagName === 'A' && cs.display === 'inline';
    if (!inlineLink && (r.width < 24 || r.height < 24)) out.small.push(desc(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if (!inlineLink && (r.width < 44 || r.height < 44)) out.touch++;
    if (!nameOf(el)) out.unnamed.push(desc(el));
  }
  return out;
}
"""


def find_browser(p):
    """Return a launched Chromium, trying the playwright-managed one first."""
    tried = []
    try:
        return p.chromium.launch(args=["--no-sandbox"]), tried
    except Exception as exc:  # noqa: BLE001
        tried.append(str(exc).strip().splitlines()[0][:120])
    candidates = []
    if os.environ.get("CHROME_PATH"):
        candidates.append(os.environ["CHROME_PATH"])
    base = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if base:
        candidates += sorted(glob.glob(os.path.join(base, "chromium-*", "chrome-linux", "chrome")), reverse=True)
    for exe in candidates:
        try:
            return p.chromium.launch(executable_path=exe, args=["--no-sandbox"]), tried
        except Exception as exc:  # noqa: BLE001
            tried.append(f"{exe}: {str(exc).strip().splitlines()[0][:100]}")
    return None, tried


def to_url(target: str) -> str:
    if target.startswith(("http://", "https://", "file://")):
        return target
    path = Path(target)
    if not path.exists():
        print(f"error: {target} not found", file=sys.stderr)
        sys.exit(2)
    return path.resolve().as_uri()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Render and measure a page (professional-ui-design skill).")
    ap.add_argument("page")
    ap.add_argument("--widths", default="320,768,1280")
    ap.add_argument("--out", default="ui-shots")
    ap.add_argument("--dark", action="store_true")
    ap.add_argument("--select", action="append", default=[], metavar="SELECTOR=VALUE")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    try:
        widths = sorted({int(w) for w in args.widths.split(",") if w.strip()})
    except ValueError:
        print("error: --widths must be comma-separated integers", file=sys.stderr)
        return 2
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright is not installed. Run: pip install playwright  (then: playwright install chromium)", file=sys.stderr)
        return 2

    url = to_url(args.page)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    widest = widths[-1]
    jobs = [(f"{w}px", w, "light", None) for w in widths]
    if args.dark:
        jobs.append((f"{widest}px dark", widest, "dark", None))
    for spec in args.select:
        if "=" not in spec:
            print(f"error: --select needs SELECTOR=VALUE, got {spec!r}", file=sys.stderr)
            return 2
        jobs.append((f"{widest}px {spec.split('=', 1)[1]}", widest, "light", spec))

    results, failed = [], False
    with sync_playwright() as p:
        browser, tried = find_browser(p)
        if not browser:
            print("Could not start Chromium. Install one (playwright install chromium) or set CHROME_PATH.", file=sys.stderr)
            for t in tried:
                print("  -", t, file=sys.stderr)
            return 2
        for label, width, scheme, select in jobs:
            ctx = browser.new_context(viewport={"width": width, "height": 800}, color_scheme=scheme, reduced_motion="reduce")
            page = ctx.new_page()
            try:
                page.goto(url, wait_until="load", timeout=20000)
                if select:
                    selector, value = select.split("=", 1)
                    page.select_option(selector, value)
                page.wait_for_timeout(150)
                data = page.evaluate(CHECK_JS)
                shot = out_dir / ("ui-" + label.replace(" ", "-") + ".png")
                page.screenshot(path=str(shot), full_page=True)
            except Exception as exc:  # noqa: BLE001
                print(f"error while checking {label}: {str(exc).splitlines()[0]}", file=sys.stderr)
                ctx.close()
                failed = True
                continue
            ctx.close()
            data.update(label=label, screenshot=str(shot))
            problems = data["overflow"] > 0 or data["contrast"] or data["small"] or data["unnamed"]
            failed = failed or bool(problems)
            results.append(data)
        browser.close()

    if args.json:
        print(json.dumps(results, indent=2))
        return 1 if failed else 0

    print(f"Rendered {args.page}")
    for r in results:
        flag = "ok " if not (r["overflow"] > 0 or r["contrast"] or r["small"] or r["unnamed"]) else "FIX"
        print(f"  [{flag}] {r['label']:<18} overflow {r['overflow']}px | contrast {len(r['contrast'])} | "
              f"targets<24px {len(r['small'])} | unnamed {len(r['unnamed'])} | text<12px {len(r['tiny'])}"
              f"  -> {r['screenshot']}")
    for r in results:
        for key, title in (("contrast", "Low contrast"), ("small", "Target under 24x24"),
                           ("unnamed", "No accessible name"), ("tiny", "Text under 12px")):
            if r[key]:
                print(f"\n{title} at {r['label']}:")
                for item in r[key][:8]:
                    print("   ", item)
                if len(r[key]) > 8:
                    print(f"    ... {len(r[key]) - 8} more")
        if r["overflow"] > 0:
            print(f"\nHorizontal overflow at {r['label']}: {r['overflow']}px. Look for fixed widths, "
                  "missing min-width: 0 on grid/flex children, or unpositioned scroll containers.")
    narrow = [r for r in results if r["touch"] and int(r["label"].split("px")[0]) <= 480]
    if narrow:
        print(f"\nAdvisory: {narrow[0]['touch']} controls are under 44px at {narrow[0]['label']} "
              "(fine for dense desktop UI; enlarge for touch-first screens).")
    if not failed:
        print("\nNo problems found. Open the screenshots and look at hierarchy, spacing and states.")
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:  # output piped into head/less and closed early
        sys.stdout = open(os.devnull, "w")
        sys.exit(1)
