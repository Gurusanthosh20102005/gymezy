# Design tokens

A token is a named design decision (a color role, a size, a radius) that components reference instead of repeating a literal value. This file explains the system; the starter values live in `assets/tokens.css` and are not repeated here.

Contents: 1 Three layers · 2 Categories and scales · 3 Building a color system · 4 Dark mode · 5 Naming · 6 Where tokens live per stack · 7 Adding or changing a token · 8 Discovering an existing system · 9 Migrating hardcoded code

## 1. Three layers

- **Primitive**: raw values (`blue-700: #1f4e79`, `space-4: 1rem`). Only the token source sees these.
- **Semantic**: roles (`color-primary`, `color-text-muted`, `color-surface`, `space-4`). Components use these. A rebrand or dark mode changes what roles point to, and components never change.
- **Component** (optional): `button-height-md`, `table-header-bg`. Add only when one component needs its own control.

Small projects can collapse primitive and semantic into one layer. Never skip semantic names for color: `--color-text-muted` survives a rebrand, `--gray-600` does not.

## 2. Categories and scales

| Category | Scale | Notes |
|---|---|---|
| Color roles | bg, surface, surface-subtle, border, border-strong, text, text-muted, text-subtle, text-disabled, primary (hover, active, subtle, on-primary), link, focus, overlay; success, warning, danger, info each with solid, subtle and text-on-subtle | Roles, not hues |
| Font family | 1 sans, plus 1 mono for code | System stack or the brand font |
| Font size | 12, 14, 16, 18, 20, 24, 30, 36 px (as rem) | 8 steps at most. App UI body 14, reading 16 to 18 |
| Line height | 1.2 headings, 1.4 UI text, 1.55 reading text | Looser for serif and for long lines |
| Weight | 400, 500, 600 | 700 only when the brand needs it |
| Space | 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px | 4px base. Use rem so it scales with user font size |
| Radius | sm 4, md 6 to 8, lg 10 to 12, full | md is the default; a role for each step |
| Border | 1px; 2px for focus and selected | |
| Elevation | none, sm, md, lg | Low-opacity neutral shadows; lg for overlays only |
| Control height | 32 (sm), 36 (md), 44 (lg, touch) | Same height for buttons, inputs and selects in a row |
| Icon size | 16, 20, 24 | One style, color inherited from text |
| Motion | 120, 200, 320 ms; one standard easing | Enter slightly slower than exit |
| z-index | sticky 10, dropdown 20, overlay 30, modal 40, toast 50 | Named, no 9999 |
| Breakpoints | 480, 768, 1024, 1280, 1536 px | Document them; CSS media queries cannot read variables |
| Containers | app content 1200 to 1280px max; reading text 65ch | |

## 3. Building a color system

1. **Brand color.** Use the project's. If it has none, pick something restrained (deep blue, teal, slate-indigo) rather than a saturated purple or neon. It must reach 4.5:1 against the surface if used for links or text, and against white if buttons carry white text.
2. **Neutral ramp.** 9 to 11 steps, tinted very slightly toward the brand hue. Text is a near-black, not `#000`; large pure-white surfaces are fine.
3. **Derived states.** Hover is one step darker, active two steps. Subtle (tint) is the brand at roughly 8 to 12% over the surface, for selected rows and soft highlights.
4. **Status colors.** Fixed hues (green, amber, red, blue), each with a solid, a subtle background, and a text color that reaches 4.5:1 on that subtle background.
5. **Control borders and focus.** Control borders need 3:1 against the surface (use `border-strong`, not the decorative divider color). The focus ring needs 3:1 against every adjacent color.
6. **Check every text/background pair**, not just the main one: `python scripts/audit_ui.py --contrast FG BG`. After changing any color token, also run `scripts/render_check.py` on a real page: the static audit cannot see through `var()`, and one weakened token can quietly fail contrast across the whole product.
7. **Budget.** On one screen: one brand color, the status colors that carry meaning, and neutrals.
8. **Charts.** Derive categorical colors from brand and neutrals first. Sequential data uses one hue ramp. Never rely on color alone: add labels, shapes or patterns.

## 4. Dark mode

- **Remap, do not invert.** Keep the same role names; give them dark values. Components stay untouched.
- **Elevation by lightness.** Raised surfaces get lighter; shadows barely show on dark backgrounds, so keep them but do not rely on them.
- **Text is off-white**, not pure white, and muted text still needs 4.5:1.
- **Brand color moves lighter** so it reaches contrast on dark surfaces. Text on a light-brand button becomes dark.
- **Recheck every pair.** Passing in light does not imply passing in dark.
- Set `color-scheme` so native controls and scrollbars match. Follow the system by default and let the user override; store the choice.
- Use the library's mechanism when it has one (AntD `algorithm`, MUI `palette.mode`, Flutter `darkTheme`) instead of hand-copied styles.

## 5. Naming

- Name by role in kebab-case: `--color-text-muted`, `--space-4`, `--radius-md`. No values in names (`--color-blue`), no one-off names (`--card-padding-on-dashboard`).
- **If the project already has a naming scheme or prefix, reuse it exactly** (for example `--ds-radius`). Never introduce a second scheme beside it.
- Names are stable. Values change; names do not.

## 6. Where tokens live per stack

Exactly one owner per project. Do not mirror values into a second place; derive from the owner.

| Stack | Owner | Consumers |
|---|---|---|
| Plain CSS, SCSS, Angular, Vue, Svelte, Astro | CSS custom properties on `:root` (+ dark override) | Component styles via `var(--token)` |
| Tailwind | `@theme` (v4) or `theme.extend` (v3), backed by CSS variables | Utility classes by semantic name |
| shadcn/ui | CSS variables in the global stylesheet (`--background`, `--primary`, `--radius`, ...) | Tailwind utilities mapped to them |
| Ant Design | `ConfigProvider` theme object (`token`, `components`, `algorithm`) | `theme.useToken()` in code, nothing else |
| MUI / Mantine / Chakra | The one theme object at the app root | Components and theme-aware props |
| Flutter | `ThemeData` + `ColorScheme` + a `ThemeExtension` for custom tokens, spacing and radius constants | `Theme.of(context)` |
| SwiftUI / Compose / React Native | Asset-catalog colors / `MaterialTheme` / a theme object in context | Semantic accessors |

## 7. Adding or changing a token

1. **Search first.** If an existing token is within a step of what you need, use it. Do not add 13px between 12 and 14, or a third blue.
2. **If it really is missing, add it to the token source first**, with a role name and the right layer, then reference it from the component. Never inline it "for now".
3. **No near-duplicates** (`gray-500` and `gray-550`).
4. **Changing a token's value is a system-wide decision.** Mention it in your report.
5. Add dark values at the same time as light values.

## 8. Discovering an existing system

Do this before choosing anything, and use what you find.

```bash
# custom properties that are defined
grep -rhoE "^\s*--[a-z0-9-]+\s*:" src styles app 2>/dev/null | sort -u | head -80

# tokens actually used, most used first
grep -rhoE "var\(--[a-z0-9-]+" src app 2>/dev/null | sort | uniq -c | sort -rn | head -40

# theme / token files
find . \( -name node_modules -o -name .git \) -prune -o \
  \( -iname "*token*" -o -iname "*theme*" -o -iname "tailwind.config.*" -o -iname "_variables.scss" \) -print
```

If the project has a profile file (`DESIGN.md` and similar), read it: it lists the project's tokens, fonts, library and conventions, and it overrides the defaults in this skill.

## 9. Migrating hardcoded code

1. Run `python scripts/audit_ui.py <folder>` to inventory literals and see the sprawl counts.
2. Group the literals into clusters and map each to the nearest existing token. Real deviations (a color used once) are usually mistakes; fold them in.
3. Replace as you touch each file. Do not mass-rewrite files the user did not ask you to restyle.
4. If the task is a restyle of the whole app, do it in coherent chunks (tokens first, then shared components, then screens) and report what changed.
