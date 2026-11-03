#!/usr/bin/env python3
"""Static UI audit for the professional-ui-design skill.

Scans source files for the patterns that make generated UI look unprofessional
or inaccessible (hardcoded values, gradients, emoji icons, missing alt text,
low contrast, hype copy, ...) and prints grouped findings.

Usage:
  python audit_ui.py PATH [PATH ...] [--json] [--strict] [--examples N]
                     [--ignore RULE,RULE] [--tokens SUBSTR]
  python audit_ui.py --contrast FG BG        # WCAG contrast of two colors
  python audit_ui.py --rules                 # list every rule

Exit status: 0 = no errors (and no warnings with --strict), 1 = findings
that fail the run, 2 = usage error.

To keep a finding on purpose, add a comment containing
    audit-ignore: rule-id        (or just: audit-ignore)
on the same line or the line above. Say why in the same comment.

Standard library only. Python 3.8+.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

# --------------------------------------------------------------------------
# Rule table: id -> (default severity, what is wrong, how to fix)
# --------------------------------------------------------------------------
RULES = {
    # errors: hard "never" items (accessibility, placeholder content, explicit bans)
    "img-no-alt": ("error", "Image without an alt attribute",
                   'Add descriptive alt text, or alt="" if the image is purely decorative.'),
    "zoom-disabled": ("error", "Viewport blocks pinch-zoom",
                      "Remove user-scalable=no / maximum-scale=1."),
    "lorem-ipsum": ("error", "Lorem ipsum placeholder text",
                    "Write real, specific copy for this product."),
    "contrast-fail": ("error", "Text/background contrast below 3:1",
                      "Choose tokens that reach 4.5:1 (check with --contrast FG BG)."),
    "gradient-text": ("error", "Gradient text",
                      "Use a solid text token; build emphasis with size and weight."),
    # warnings: fix, or justify with audit-ignore
    "hardcoded-color": ("warn", "Literal color outside the token source",
                        "Use a color token: var(--color-...), a theme color, or Theme.of(context).colorScheme."),
    "gradient": ("warn", "Gradient background",
                 "Use a solid token color. Gradients are fine only as image scrims or skeleton shimmer."),
    "glass-blur": ("warn", "Glass / backdrop-blur effect",
                   "Keep only for modal scrims or a sticky header; avoid as decoration."),
    "heavy-shadow": ("warn", "Heavy shadow (large blur)",
                     "Use a subtle elevation token (low opacity, small blur); overlays only for the largest."),
    "colored-shadow": ("warn", "Colored shadow or glow",
                       "Use a neutral elevation token."),
    "emoji-ui": ("warn", "Emoji in UI text or markup",
                 "Use one icon set for functional icons; plain words otherwise."),
    "important": ("warn", "!important",
                  "Fix specificity or use a token/theme override instead."),
    "outline-removed": ("warn", "Focus outline removed",
                        "Provide a visible :focus-visible replacement (2px ring, 3:1 contrast)."),
    "transition-all": ("warn", "transition: all",
                       "List the properties you animate (color, background-color, box-shadow, transform)."),
    "tiny-text": ("warn", "Text smaller than 12px",
                  "Use 12px at the very smallest; prefer 14px for UI text."),
    "odd-spacing": ("warn", "Odd pixel spacing (not on a 4px/2px grid)",
                    "Use a spacing token (4, 8, 12, 16, 24, 32, 48...)."),
    "fallback-identity": ("warn", "Hardcoded fallback identity (an email literal used as a default)",
                          "Render a skeleton or empty value until real data loads; keep demo data in fixtures."),
    "dead-link": ("warn", 'Placeholder link (href="#" or javascript:)',
                  "Link to a real route, or use a button for actions."),
    "click-on-non-interactive": ("warn", "Click handler on a non-interactive element",
                                 "Use a native button (or a link) so keyboard and screen-reader users can operate it."),
    "hype-copy": ("warn", "Hype / filler wording",
                  "Say plainly what it does. No 'seamless', 'supercharge', 'unleash'."),
    "vague-copy": ("warn", "Vague error or filler wording",
                   "Say what happened and how to fix it. No 'Oops', no 'Something went wrong'."),
    "tailwind-arbitrary": ("warn", "Tailwind arbitrary value for color/size/radius/spacing",
                           "Add it to the theme and use the named utility."),
    "contrast-low": ("warn", "Text/background contrast between 3:1 and 4.5:1",
                     "Fine only for large text (24px, or 18.66px bold). Otherwise reach 4.5:1."),
    "html-no-lang": ("warn", "<html> without a lang attribute", 'Add lang="en" (or the page language).'),
    "no-viewport": ("warn", "No viewport meta tag", 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'),
    "no-token-source": ("warn", "No central token/theme source found",
                        "Create one before styling components (see assets/tokens.css or the stack file)."),
    "font-sprawl": ("warn", "More than 2 font families", "Use one family (plus one mono for code)."),
    "size-sprawl": ("warn", "Too many distinct font sizes", "Consolidate to a scale of 6-8 sizes."),
    "radius-sprawl": ("warn", "Too many distinct border radii", "Use one base radius plus at most a smaller and a larger step."),
    "color-sprawl": ("warn", "Too many distinct literal colors", "Move colors into tokens and reuse them."),
    # deferred severity: warn when a token source exists (this file ignores it), info otherwise
    "hardcoded-font-size": ("deferred", "Literal font size outside the token source",
                            "Use a type-scale token."),
    "hardcoded-radius": ("deferred", "Literal border radius outside the token source",
                         "Use a radius token."),
    # info: advisory
    "uppercase-text": ("info", "ALL CAPS text transform", "Use sentence case unless the brand requires caps."),
    "fixed-width": ("info", "Fixed pixel width of 640px or more",
                    "Use max-width plus fluid width so small screens do not scroll sideways."),
    "z-index-high": ("info", "Arbitrary high z-index", "Use a named z-index scale."),
    "placeholder-data": ("info", "Placeholder sample data (John Doe, Acme Inc...)",
                         "Use realistic, domain-specific sample data."),
    "dart-raw-spacing": ("info", "Raw numbers in EdgeInsets", "Use spacing constants from the theme."),
}

# Rules that are about literal values; skipped inside token/theme files,
# because that is the one place raw values are meant to live.
LITERAL_RULES = {
    "hardcoded-color", "hardcoded-font-size", "hardcoded-radius", "gradient",
    "heavy-shadow", "colored-shadow", "tiny-text", "odd-spacing", "fixed-width",
    "z-index-high", "tailwind-arbitrary", "dart-raw-spacing", "glass-blur",
    "transition-all", "important",
}

# --------------------------------------------------------------------------
# File discovery
# --------------------------------------------------------------------------
STYLE_EXT = {".css", ".scss", ".sass", ".less"}
MARKUP_EXT = {".html", ".htm", ".vue", ".svelte", ".astro", ".jsx", ".tsx"}
SCRIPT_EXT = {".js", ".ts", ".mjs"}
DART_EXT = {".dart"}
SCAN_EXT = STYLE_EXT | MARKUP_EXT | SCRIPT_EXT | DART_EXT

SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", "out", ".next", ".nuxt", ".svelte-kit",
    ".angular", ".turbo", ".cache", "coverage", "vendor", "__pycache__", ".dart_tool",
    ".venv", "venv", "__MACOSX", "storybook-static", "ios", "android", "macos",
    "windows", "linux", "Pods", ".idea", ".vscode",
}
TEST_RE = re.compile(r"(?:[._-](?:test|spec)\.\w+$)|(?:^|/)__(?:tests|mocks)__/", re.I)
MAX_BYTES = 1_500_000
MAX_LINE = 1500

TOKEN_FILE_RE = re.compile(
    r"^_?(?:design[-_]?)?(?:tokens?|themes?|variables|vars|colou?rs|palette|"
    r"app[-_]?(?:theme|colou?rs)|brand|ant[-_]?theme|theme[-_]?config)(?:[-_.].*)?$", re.I)
TOKEN_DIRS = {"theme", "themes", "tokens", "design-tokens"}
TOKEN_SOURCE_RE = re.compile(
    r"@theme\b|ThemeData\s*\(|ThemeExtension\b|createTheme\s*\(|extendTheme\s*\(|"
    r"createSystem\s*\(|MantineProvider|ColorScheme\s*\(|ColorScheme\.from|"
    r"MaterialTheme\s*\(|ConfigProvider\b[^>]*\btheme\s*=|(?:^|\n)\s*:root\s*\{")

# --------------------------------------------------------------------------
# Patterns
# --------------------------------------------------------------------------
CUSTOM_PROP_DEF = re.compile(r"^\s*--[\w-]+\s*:")
CUSTOM_DECL = re.compile(r"(?<![\w-])--[\w-]+\s*:[^;{}]*(?:;|(?=\}))?")
HEX_LONG = re.compile(r"(?<![\w&#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})(?![\w-])")
HEX_SHORT = re.compile(r"(?<![\w&#])#(?:[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])")
FUNC_COLOR = re.compile(r"\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch)\(\s*[\d.]")
GRADIENT_FN = re.compile(r"\b(?:repeating-)?(?:linear|radial|conic)-gradient\(")
GRADIENT_TW = re.compile(
    r"\bbg-gradient-to-[a-z]{1,2}\b|\bbg-(?:linear|radial|conic)(?:-to-[a-z]{1,2}|-\d+|-\[|\b)|"
    r"\b(?:from|via|to)-(?:[a-z]+-\d{2,3}|\[#?[\w.%-]+\])")
GRADIENT_TEXT = re.compile(
    r"background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text|\bbg-clip-text\b")
GLASS = re.compile(r"backdrop-filter\s*:\s*[^;]*blur|\bbackdrop-blur(?:-[\w\[\]./]+)?\b")
BOX_SHADOW = re.compile(r"box-shadow\s*:\s*([^;}{]+)")
TW_COLORED_SHADOW = re.compile(
    r"\bshadow-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|"
    r"violet|purple|fuchsia|pink|rose)-\d{2,3}")
TW_HEAVY_SHADOW = re.compile(r"\bshadow-2xl\b")
IMPORTANT = re.compile(r"!\s*important\b")
OUTLINE_REMOVED = re.compile(
    r"\boutline\s*:\s*(?:none|0)\b|\boutline-style\s*:\s*none|(?<![\w-])outline-none\b")
FOCUS_REPLACEMENT = re.compile(
    r"focus(?:-visible|-within)?:(?:ring|border|outline|shadow|bg)")
TRANSITION_ALL = re.compile(r"\btransition(?:-property)?\s*:\s*all\b")
FONT_SIZE_CSS = re.compile(r"(?<![\w-])font-size\s*:\s*([\d.]+)(px|rem|em|pt)\b")
FONT_SIZE_JS = re.compile(r"\bfontSize\s*:\s*['\"]?([\d.]+)(px|rem|em)?['\"]?")
FONT_SIZE_TW = re.compile(r"\btext-\[([\d.]+)(px|rem)\]")
RADIUS_CSS = re.compile(r"(?<![\w-])border-radius\s*:\s*([^;}{]+)")
RADIUS_JS = re.compile(r"\bborderRadius\s*:\s*['\"]?([\d.]+)(px|rem)?['\"]?")
RADIUS_DART = re.compile(r"\b(?:Border)?Radius\.circular\(\s*([\d.]+)")
SPACING_DECL = re.compile(
    r"(?<![\w-])(?:margin|padding|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block)"
    r"(?:-(?:start|end))?)?\s*:\s*([^;}{]+)")
WIDTH_FIXED = re.compile(r"(?<![\w-])(?:min-)?width\s*:\s*(\d{3,4})px")
Z_INDEX = re.compile(r"(?<![\w-])z-index\s*:\s*(\d+)|\bz-\[(\d+)\]")
UPPERCASE = re.compile(r"text-transform\s*:\s*uppercase|class(?:Name)?\s*=\s*[\"'{`][^\"'`}]*\buppercase\b")
TW_ARBITRARY = re.compile(
    r"\b(?:text|rounded|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y|"
    r"leading|tracking|border|ring|bg|from|via|to|fill|stroke|shadow)"
    r"-\[(?:#[0-9a-fA-F]{3,8}|-?\d+(?:\.\d+)?(?:px|rem|em))\]")
DEAD_LINK = re.compile(
    r"""href\s*=\s*(?:(["'])#\1|\{\s*(["'])#\2\s*\}|["']javascript:)""", re.I)
FALLBACK_IDENTITY = re.compile(
    r"(?:\|\||\?\?)\s*['\"`][\w.+-]+@[\w-]+\.[\w.-]+['\"`]")
LOREM = re.compile(r"lorem ipsum|dolor sit amet", re.I)
HYPE = re.compile(
    r"welcome to the future|revolutioni[sz]e|supercharge|unleash|game[- ]?changer|"
    r"next[- ]gen(?:eration)?\b|cutting[- ]edge|\bseamless(?:ly)?\b|\beffortless(?:ly)?\b|"
    r"elevate your|unlock the power|to the next level|reimagine[d]?\b|"
    r"blazing[- ]fast|lightning[- ]fast|world[- ]class|state[- ]of[- ]the[- ]art", re.I)
VAGUE = re.compile(r"\boops\b|\bwhoops\b|\buh[- ]oh\b|something went wrong", re.I)
PLACEHOLDER_DATA = re.compile(
    r"\bjohn doe\b|\bjane doe\b|\bacme (?:inc|corp|co)\b|\buser@example\.com\b|\bfoo@bar\b", re.I)
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\u2600-\u2604\u2607-\u26FF\u2705\u2728\u274C\u274E\u2753-\u2755"
    "\u2757\u2B50\u2B1B\u2B1C\u23E9-\u23FA\u231A\u231B]")
ZOOM_OFF = re.compile(r"user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\.0)?(?![\d.])", re.I)
ALT_PRESENT = re.compile(r"(?<![\w/.-])alt(?![\w-])")
IMG_TAG = re.compile(r"<(img|Image)\b((?:[^<>]|=>){0,3000})>")
CLICK_TAG = re.compile(
    r"<(div|span|li|td|tr|p|section|article|img|svg|i)\b((?:[^<>]|=>){0,3000})>")
CLICK_ATTR = re.compile(
    r"(?:\bonclick|@click(?:\.\w+)*|v-on:click(?:\.\w+)*|\(click\)|\bon:click)\s*=", re.I)
CSS_BLOCK = re.compile(r"([^{}]+)\{([^{}]*)\}")
INLINE_STYLE = re.compile(r"style\s*=\s*\"([^\"]*)\"")
FG_DECL = re.compile(r"(?<![-\w])color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))")
BG_DECL = re.compile(r"(?<![-\w])background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))")
JS_FG = re.compile(r"(?<![-\w])color\s*:\s*['\"](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))['\"]")
JS_BG = re.compile(r"(?<![-\w])background(?:Color)?\s*:\s*['\"](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))['\"]")
FONT_FAMILY_CSS = re.compile(r"(?<![\w-])font-family\s*:\s*([^;}{]+)")
FONT_FAMILY_JS = re.compile(r"\bfontFamily\s*:\s*['\"]([^'\"]+)['\"]")
LOOKS_UI = re.compile(
    r"from\s+['\"](?:react|preact|vue|solid-js|lit|@angular/core|svelte)|React\.createElement|"
    r"return\s*\(\s*<|<\w[^>]*>[^<]*</\w+>")

SYSTEM_MARKERS = ("system-ui", "-apple-system", "blinkmacsystemfont", "ui-sans-serif", "segoe ui")
MONO_MARKERS = ("monospace", "mono", "consolas", "courier", "menlo")

# --------------------------------------------------------------------------
# Color math (WCAG 2.x)
# --------------------------------------------------------------------------
NAMED = {"white": (255, 255, 255, 1.0), "black": (0, 0, 0, 1.0)}


def parse_color(value: str):
    """Return (r, g, b, a) or None."""
    v = value.strip().lower()
    if v in NAMED:
        return NAMED[v]
    if v.startswith("#"):
        h = v[1:]
        if len(h) in (3, 4):
            h = "".join(ch * 2 for ch in h)
        if len(h) not in (6, 8) or not re.fullmatch(r"[0-9a-f]+", h):
            return None
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    m = re.fullmatch(r"rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)", v)
    if m:
        def chan(s):
            return round(float(s[:-1]) * 2.55) if s.endswith("%") else round(float(s))
        a = 1.0
        if m.group(4):
            a = float(m.group(4)[:-1]) / 100 if m.group(4).endswith("%") else float(m.group(4))
        return chan(m.group(1)), chan(m.group(2)), chan(m.group(3)), a
    return None


def _lin(c: float) -> float:
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb) -> float:
    r, g, b = rgb[:3]
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def contrast_ratio(a, b) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def is_neutral(rgb, spread: int = 48) -> bool:
    return max(rgb[:3]) - min(rgb[:3]) <= spread


def norm_hex(h: str) -> str:
    h = h.lower().lstrip("#")
    if len(h) in (3, 4):
        h = "".join(ch * 2 for ch in h)
    return "#" + h[:6]


def to_px(num: str, unit: str | None) -> float:
    n = float(num)
    if unit in ("rem", "em"):
        return n * 16
    if unit == "pt":
        return n * 1.333
    return n


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def strip_comments(text: str, ext: str) -> str:
    """Blank out comments but keep newlines, so line numbers stay correct."""
    def blank(m):
        return re.sub(r"[^\n]", " ", m.group(0))
    text = re.sub(r"/\*.*?\*/", blank, text, flags=re.S)
    if ext in MARKUP_EXT:
        text = re.sub(r"<!--.*?-->", blank, text, flags=re.S)
    if ext != ".css":
        text = re.sub(r"(?<![:\"'(\w])//[^\n]*", blank, text)
    return text


NOT_COLOR_PREFIX = re.compile(
    r"(?:\b(?:href|to|src|id|for|name|xlink:href|data-[\w-]+|aria-[\w-]+)\s*=\s*[\"'`{]*\s*"
    r"|(?:querySelector(?:All)?|closest|matches|getElementById|\$|jQuery)\(\s*[\"'`]\s*)$", re.I)


def color_context(prefix: str) -> bool:
    """True when a '#hex' really is used as a color value (not an id/anchor/text)."""
    if NOT_COLOR_PREFIX.search(prefix):
        return False
    return bool(re.search(r"[\"'`(=\[]\s*$", prefix) or re.search(r":[^;{}]*$", prefix))


def line_of(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def split_top_level(s: str):
    parts, depth, cur = [], 0, []
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    parts.append("".join(cur))
    return parts


def parse_ignores(raw_lines):
    """Map line number -> set of ignored rule ids ('*' means all)."""
    out = defaultdict(set)
    for i, line in enumerate(raw_lines, 1):
        m = re.search(r"audit-ignore(?::\s*([\w,\s-]+))?", line)
        if not m:
            continue
        ids = {x.strip() for x in (m.group(1) or "*").split(",") if x.strip()} or {"*"}
        out[i] |= ids
        out[i + 1] |= ids
    return out


class Context:
    def __init__(self, extra_token_substrings):
        self.extra = [s.lower() for s in extra_token_substrings]
        self.findings = []
        self.token_found = False
        self.files_scanned = 0
        self.kinds = Counter()
        self.colors = Counter()
        self.font_sizes = Counter()
        self.radii = Counter()
        self.fonts = Counter()
        self.literal_hits = 0

    def is_token_file(self, path: Path) -> bool:
        name = path.name.lower()
        if name.startswith("tailwind.config"):
            return True
        if TOKEN_FILE_RE.match(path.stem):
            return True
        if path.parent.name.lower() in TOKEN_DIRS and path.stem.lower() in {"index", "main", "default"}:
            return True
        p = path.as_posix().lower()
        return any(s in p for s in self.extra)


# --------------------------------------------------------------------------
# Per-file scan
# --------------------------------------------------------------------------
def scan_file(path: Path, display: str, ctx: Context) -> None:
    ext = path.suffix.lower()
    try:
        if path.stat().st_size > MAX_BYTES:
            return
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return

    ctx.files_scanned += 1
    ctx.kinds["dart" if ext in DART_EXT else "css" if ext in STYLE_EXT else "markup/script"] += 1
    is_dart = ext in DART_EXT
    token_file = ctx.is_token_file(path)
    text = strip_comments(raw, ext)
    lines = text.split("\n")
    ignores = parse_ignores(raw.split("\n"))
    ui = ext in MARKUP_EXT or ext in STYLE_EXT or is_dart or bool(LOOKS_UI.search(text))

    if token_file or TOKEN_SOURCE_RE.search(text) or sum(1 for ln in lines if CUSTOM_PROP_DEF.match(ln)) >= 3:
        ctx.token_found = True

    seen = set()

    def add(rule, lineno, snippet, sev=None):
        if rule in LITERAL_RULES and token_file:
            return
        ign = ignores.get(lineno, ())
        if "*" in ign or rule in ign:
            return
        if (rule, lineno) in seen:      # one finding per rule per line
            return
        seen.add((rule, lineno))
        ctx.findings.append({
            "rule": rule, "sev": sev, "file": display, "line": lineno,
            "snippet": re.sub(r"\s+", " ", snippet).strip()[:140],
        })
        if rule in ("hardcoded-color", "hardcoded-font-size", "hardcoded-radius"):
            ctx.literal_hits += 1

    # ---- multi-line checks over the whole text ----------------------------
    for m in IMG_TAG.finditer(text):
        attrs = m.group(2)
        if not ALT_PRESENT.search(attrs) and not re.search(r"\{\s*\.\.\.", attrs):
            add("img-no-alt", line_of(text, m.start()), m.group(0))

    for m in CLICK_TAG.finditer(text):
        if CLICK_ATTR.search(m.group(2)):
            add("click-on-non-interactive", line_of(text, m.start()), m.group(0))

    if ext in (".html", ".htm"):
        head = re.search(r"<html\b[^>]*>", text, re.I)
        if head:
            if not re.search(r"\blang\s*=", head.group(0), re.I):
                add("html-no-lang", line_of(text, head.start()), head.group(0))
            if not re.search(r"name\s*=\s*[\"']viewport[\"']", text, re.I):
                add("no-viewport", line_of(text, head.start()), "<html> ... (no viewport meta)")

    for m in ZOOM_OFF.finditer(text):
        add("zoom-disabled", line_of(text, m.start()), m.group(0))

    if ext in STYLE_EXT or ext in MARKUP_EXT or ext in (".html", ".htm"):
        blocks = [(m.start(2), m.group(2)) for m in CSS_BLOCK.finditer(text)]
        blocks += [(m.start(1), m.group(1)) for m in INLINE_STYLE.finditer(text)]
        for start, body in blocks:
            fg, bg = FG_DECL.search(body), BG_DECL.search(body)
            if not (fg and bg):
                continue
            c1, c2 = parse_color(fg.group(1)), parse_color(bg.group(1))
            if not c1 or not c2 or c1[3] < 1 or c2[3] < 1:
                continue
            ratio = contrast_ratio(c1, c2)
            lineno = line_of(text, start + fg.start())
            note = f"color {fg.group(1)} on {bg.group(1)} = {ratio:.2f}:1"
            if ratio < 3:
                add("contrast-fail", lineno, note)
            elif ratio < 4.5:
                add("contrast-low", lineno, note)

    outline_ok = set()          # lines whose removed outline has a replacement in the same rule
    for m in CSS_BLOCK.finditer(text):
        body = m.group(2)
        if OUTLINE_REMOVED.search(body) and re.search(
                r"box-shadow\s*:\s*(?!none)|border(?:-color)?\s*:|outline-color", body):
            for om in OUTLINE_REMOVED.finditer(body):
                outline_ok.add(line_of(text, m.start(2) + om.start()))

    # ---- line checks ------------------------------------------------------
    for n, line in enumerate(lines, 1):
        if len(line) > MAX_LINE or not line.strip():
            continue
        in_console = "console." in line
        line = CUSTOM_DECL.sub(" ", line)      # token definitions are allowed to hold raw values
        if not line.strip():
            continue

        if is_dart:
            if not token_file:
                if re.search(r"\bColor\(\s*0x[0-9a-fA-F]{6,8}\s*\)", line):
                    add("hardcoded-color", n, line)
                elif re.search(r"\bColors\.(?!transparent\b)[a-zA-Z]+", line):
                    add("hardcoded-color", n, line)
                for m in re.finditer(r"\bfontSize\s*:\s*([\d.]+)", line):
                    px = float(m.group(1))
                    ctx.font_sizes[round(px * 2) / 2] += 1
                    add("tiny-text" if px < 12 else "hardcoded-font-size", n, line)
                for m in RADIUS_DART.finditer(line):
                    ctx.radii[float(m.group(1))] += 1
                    add("hardcoded-radius", n, line)
                if re.search(r"\bEdgeInsets\.\w+\([^)]*\d", line):
                    add("dart-raw-spacing", n, line)
                for m in re.finditer(r"\bfontFamily\s*:\s*'([^']+)'", line):
                    ctx.fonts[m.group(1).lower()] += 1
        else:
            custom_def = False
            if not token_file:
                hit = bool(FUNC_COLOR.search(line))
                for rx in (HEX_LONG, HEX_SHORT):
                    for m in rx.finditer(line):
                        if color_context(line[:m.start()]):
                            ctx.colors[norm_hex(m.group(0))] += 1
                            hit = True
                if hit:
                    add("hardcoded-color", n, line)

            if not custom_def:
                if GRADIENT_TEXT.search(line):
                    add("gradient-text", n, line)
                if GRADIENT_FN.search(line) or GRADIENT_TW.search(line):
                    add("gradient", n, line)
                if GLASS.search(line):
                    add("glass-blur", n, line)
                if TW_COLORED_SHADOW.search(line):
                    add("colored-shadow", n, line)
                if TW_HEAVY_SHADOW.search(line):
                    add("heavy-shadow", n, line)
                for m in BOX_SHADOW.finditer(line):
                    val = m.group(1)
                    if "var(" in val:
                        continue
                    for shadow in split_top_level(val):
                        colors = re.findall(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)", shadow)
                        stripped = re.sub(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)", " ", shadow)
                        lengths = [to_px(a, b or None) for a, b in re.findall(r"(-?\d*\.?\d+)(px|rem|em)?", stripped)]
                        if len(lengths) >= 3 and lengths[2] >= 32:
                            add("heavy-shadow", n, line)
                        for c in colors:
                            parsed = parse_color(c)
                            if parsed and not is_neutral(parsed):
                                add("colored-shadow", n, line)
                                break

                if IMPORTANT.search(line):
                    add("important", n, line)
                if OUTLINE_REMOVED.search(line) and not FOCUS_REPLACEMENT.search(line) and n not in outline_ok:
                    add("outline-removed", n, line)
                if TRANSITION_ALL.search(line):
                    add("transition-all", n, line)
                if UPPERCASE.search(line):
                    add("uppercase-text", n, line)
                if DEAD_LINK.search(line):
                    add("dead-link", n, line)
                if FALLBACK_IDENTITY.search(line):
                    add("fallback-identity", n, line)
                if TW_ARBITRARY.search(line):
                    add("tailwind-arbitrary", n, line)

                for m in FONT_SIZE_CSS.finditer(line):
                    px = to_px(m.group(1), m.group(2))
                    if px == 0:
                        continue
                    if not token_file:
                        ctx.font_sizes[round(px * 2) / 2] += 1
                    add("tiny-text" if px < 12 else "hardcoded-font-size", n, line)
                for m in list(FONT_SIZE_JS.finditer(line)) + list(FONT_SIZE_TW.finditer(line)):
                    px = to_px(m.group(1), m.group(2) if m.lastindex and m.lastindex >= 2 else None)
                    if px == 0:
                        continue
                    if not token_file:
                        ctx.font_sizes[round(px * 2) / 2] += 1
                    add("tiny-text" if px < 12 else "hardcoded-font-size", n, line)

                for m in RADIUS_CSS.finditer(line):
                    val = m.group(1)
                    if "var(" in val or "calc(" in val or "inherit" in val:
                        continue
                    for num, unit in re.findall(r"(\d*\.?\d+)(px|rem|em|%)?", val):
                        if unit == "%":
                            continue
                        px = to_px(num, unit or None)
                        if px == 0 or px >= 999:
                            continue
                        if not token_file:
                            ctx.radii[px] += 1
                        add("hardcoded-radius", n, line)
                for m in RADIUS_JS.finditer(line):
                    px = to_px(m.group(1), m.group(2))
                    if 0 < px < 999:
                        if not token_file:
                            ctx.radii[px] += 1
                        add("hardcoded-radius", n, line)

                for m in SPACING_DECL.finditer(line):
                    val = m.group(1)
                    if "var(" in val or "calc(" in val:
                        continue
                    for num in re.findall(r"(-?\d+)px", val):
                        v = abs(int(num))
                        if v >= 3 and v % 2 == 1:
                            add("odd-spacing", n, line)
                            break

                for m in WIDTH_FIXED.finditer(line):
                    before = line[:m.start()]
                    if before.count("(") > before.count(")"):    # inside @media (...) / @container (...)
                        continue
                    if int(m.group(1)) >= 640:
                        add("fixed-width", n, line)
                for m in Z_INDEX.finditer(line):
                    if int(m.group(1) or m.group(2)) >= 1000:
                        add("z-index-high", n, line)

                for m in FONT_FAMILY_CSS.finditer(line):
                    val = m.group(1).lower()
                    if "var(" in val or "inherit" in val or token_file:
                        continue
                    fams = [f.strip().strip("'\"") for f in val.split(",") if f.strip()]
                    if not fams:
                        continue
                    if any(any(mk in f for mk in SYSTEM_MARKERS) for f in fams):
                        ctx.fonts["system-ui"] += 1
                    elif any(any(mk in f for mk in MONO_MARKERS) for f in fams):
                        continue
                    elif fams[0] not in ("sans-serif", "serif"):
                        ctx.fonts[fams[0]] += 1
                for m in FONT_FAMILY_JS.finditer(line):
                    if token_file:
                        continue
                    first = m.group(1).split(",")[0].strip().strip("'\"").lower()
                    if first and not any(mk in first for mk in SYSTEM_MARKERS + MONO_MARKERS):
                        ctx.fonts[first] += 1

        if not is_dart and ext not in STYLE_EXT:
            fg, bg = JS_FG.search(line), JS_BG.search(line)
            if fg and bg:
                c1, c2 = parse_color(fg.group(1)), parse_color(bg.group(1))
                if c1 and c2 and c1[3] == 1 and c2[3] == 1:
                    ratio = contrast_ratio(c1, c2)
                    note = f"color {fg.group(1)} on {bg.group(1)} = {ratio:.2f}:1"
                    if ratio < 3:
                        add("contrast-fail", n, note)
                    elif ratio < 4.5:
                        add("contrast-low", n, note)

        # copy / content checks apply to UI source only, never to server logs
        if ui and ext not in STYLE_EXT and not in_console:
            if LOREM.search(line):
                add("lorem-ipsum", n, line)
            if HYPE.search(line):
                add("hype-copy", n, line)
            if VAGUE.search(line):
                add("vague-copy", n, line)
            if PLACEHOLDER_DATA.search(line):
                add("placeholder-data", n, line)
            if EMOJI.search(line):
                add("emoji-ui", n, line)


# --------------------------------------------------------------------------
# Project-level checks, discovery, reporting
# --------------------------------------------------------------------------
def project_checks(ctx: Context) -> None:
    def add(rule, snippet):
        ctx.findings.append({"rule": rule, "sev": None, "file": "(project)", "line": 0, "snippet": snippet[:140]})

    if ctx.files_scanned and not ctx.token_found and ctx.literal_hits:
        add("no-token-source", "No tokens.css / :root variables / theme file / ThemeData found in the scanned files")
    if len(ctx.fonts) > 2:
        add("font-sprawl", ", ".join(sorted(ctx.fonts)))
    if len(ctx.font_sizes) > 8:
        add("size-sprawl", f"{len(ctx.font_sizes)} sizes: " + ", ".join(f"{s:g}" for s in sorted(ctx.font_sizes)))
    if len(ctx.radii) > 4:
        add("radius-sprawl", f"{len(ctx.radii)} radii: " + ", ".join(f"{r:g}" for r in sorted(ctx.radii)))
    if len(ctx.colors) > 12:
        add("color-sprawl", f"{len(ctx.colors)} distinct literal colors")


def discover(paths):
    for p in paths:
        p = Path(p)
        if p.is_file():
            yield p, p.parent
        elif p.is_dir():
            stack = [p]
            while stack:
                d = stack.pop()
                try:
                    entries = sorted(d.iterdir())
                except OSError:
                    continue
                for e in entries:
                    if e.is_dir():
                        if e.name not in SKIP_DIRS and not e.name.startswith("."):
                            stack.append(e)
                    elif e.suffix.lower() in SCAN_EXT:
                        name = e.name.lower()
                        rel = e.as_posix()
                        if ".min." in name or TEST_RE.search(rel):
                            continue
                        yield e, p
        else:
            print(f"warning: {p} not found", file=sys.stderr)


def resolve_severity(f, token_found: bool) -> str:
    if f["sev"]:
        return f["sev"]
    sev = RULES[f["rule"]][0]
    if sev == "deferred":
        return "warn" if token_found else "info"
    return sev


def report_text(ctx: Context, examples: int, ignore: set) -> int:
    groups = defaultdict(list)
    for f in ctx.findings:
        if f["rule"] in ignore:
            continue
        f["sev"] = resolve_severity(f, ctx.token_found)
        groups[(f["sev"], f["rule"])].append(f)

    kinds = ", ".join(f"{v} {k}" for k, v in ctx.kinds.items()) or "none"
    print(f"UI audit: {ctx.files_scanned} files scanned ({kinds}); token source: "
          f"{'found' if ctx.token_found else 'NOT found'}")

    totals = Counter()
    for sev, label in (("error", "ERRORS"), ("warn", "WARNINGS"), ("info", "INFO")):
        rules = sorted((r for (s, r) in groups if s == sev), key=lambda r: -len(groups[(sev, r)]))
        if not rules:
            continue
        count = sum(len(groups[(sev, r)]) for r in rules)
        totals[sev] = count
        print(f"\n{label} ({count})")
        for r in rules:
            items = groups[(sev, r)]
            _, what, fix = RULES[r]
            print(f"  {r} x{len(items)}: {what}")
            print(f"      fix: {fix}")
            for it in items[:examples]:
                loc = f"{it['file']}:{it['line']}" if it["line"] else it["file"]
                print(f"      {loc}  {it['snippet']}")
            if len(items) > examples:
                print(f"      ... {len(items) - examples} more")
    if not totals:
        print("\nNo findings.")
    print(f"\nSummary: {totals['error']} errors, {totals['warn']} warnings, {totals['info']} info.")
    if totals["error"] or totals["warn"]:
        print("Fix errors. Fix warnings or keep them on purpose with a comment: audit-ignore: rule-id (reason).")
    return totals["error"], totals["warn"]


def report_json(ctx: Context, ignore: set):
    out = []
    totals = Counter()
    for f in ctx.findings:
        if f["rule"] in ignore:
            continue
        f["sev"] = resolve_severity(f, ctx.token_found)
        f["message"] = RULES[f["rule"]][1]
        f["fix"] = RULES[f["rule"]][2]
        totals[f["sev"]] += 1
        out.append(f)
    out.sort(key=lambda f: ({"error": 0, "warn": 1, "info": 2}[f["sev"]], f["file"], f["line"]))
    print(json.dumps({
        "files_scanned": ctx.files_scanned, "token_source_found": ctx.token_found,
        "summary": dict(totals), "findings": out,
    }, indent=2))
    return totals["error"], totals["warn"]


def contrast_cli(fg: str, bg: str) -> int:
    c1, c2 = parse_color(fg), parse_color(bg)
    if not c1 or not c2:
        print("Could not parse a color. Use #rgb, #rrggbb, rgb(r,g,b), white or black.", file=sys.stderr)
        return 2
    if c1[3] < 1 or c2[3] < 1:
        print("Note: transparency ignored; compare against the final blended colors.", file=sys.stderr)
    ratio = contrast_ratio(c1, c2)

    def verdict(limit):
        return "pass" if ratio >= limit else "FAIL"
    print(f"Foreground {fg} on background {bg}")
    print(f"Contrast ratio: {ratio:.2f}:1")
    print(f"  AA   normal text (4.5:1): {verdict(4.5)}")
    print(f"  AA   large text and UI components (3:1): {verdict(3)}")
    print(f"  AAA  normal text (7:1): {verdict(7)}")
    return 0 if ratio >= 4.5 else 1


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Static UI audit (professional-ui-design skill).")
    ap.add_argument("paths", nargs="*", help="files or folders to scan")
    ap.add_argument("--contrast", nargs=2, metavar=("FG", "BG"), help="print WCAG contrast of two colors")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--strict", action="store_true", help="fail on warnings too")
    ap.add_argument("--examples", type=int, default=3, help="examples shown per rule (default 3)")
    ap.add_argument("--ignore", default="", help="comma-separated rule ids to skip")
    ap.add_argument("--tokens", action="append", default=[],
                    help="treat paths containing this text as token/theme files (repeatable)")
    ap.add_argument("--rules", action="store_true", help="list all rules and exit")
    args = ap.parse_args(argv)

    if args.rules:
        for rid, (sev, what, fix) in RULES.items():
            print(f"{rid:26} {('warn/info' if sev == 'deferred' else sev):9} {what}")
        return 0
    if args.contrast:
        return contrast_cli(*args.contrast)
    if not args.paths:
        ap.print_usage(sys.stderr)
        print("error: give at least one file or folder, or use --contrast / --rules", file=sys.stderr)
        return 2

    ctx = Context(args.tokens)
    for path, root in discover(args.paths):
        try:
            display = path.relative_to(Path.cwd()).as_posix()
        except ValueError:
            display = path.as_posix()
        scan_file(path, display, ctx)
    project_checks(ctx)

    ignore = {r.strip() for r in args.ignore.split(",") if r.strip()}
    errors, warns = (report_json(ctx, ignore) if args.json else report_text(ctx, args.examples, ignore))
    if errors or (args.strict and warns):
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:  # output piped into head/less and closed early
        sys.stdout = open(os.devnull, "w")
        sys.exit(1)
