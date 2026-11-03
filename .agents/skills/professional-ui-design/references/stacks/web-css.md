# Plain web: HTML, CSS, SCSS, Angular, Vue, Svelte, Astro, and single-file prototypes

For projects styled with their own CSS. The whole job is strict token usage: components consume CSS custom properties, and a literal value never appears outside the token source.

Contents: 1 Tokens and where they live · 2 Strict token usage (bad and good) · 3 CSS craft · 4 Framework notes · 5 Single-file prototypes and HTML artifacts

## 1. Tokens and where they live

1. **Find the token source first** (see `references/design-tokens.md` section 8): usually `:root` in `styles.css`, `tokens.css`, or `_variables.scss`. Consume exactly those variables with their exact names and prefix.
2. **If there is none**, copy `assets/tokens.css` into the project, change the brand block, and import it once at the global entry (`styles.css`, `main.ts`, `app.css`, layout file).
3. **If a token you need does not exist**, add it to the token source first (with its dark value if the project has dark mode), then use it. Do not inline a value "for now".
4. Never redefine a token's value inside a component to change it locally. If a component needs a variant, give it its own component-level token or a modifier class.

## 2. Strict token usage

Bad: magic values, repeated in every file.

```scss
.user-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 15px;
  gap: 10px;
  box-shadow: 0 8px 40px rgba(99, 102, 241, 0.35);
  transition: all 0.3s;

  &:hover { transform: translateY(-4px); }

  .title {
    font-size: 14px;
    font-family: 'Poppins', sans-serif;
    color: #0f172a;
    text-transform: uppercase;
  }
}
```

Good: every decision is a token, motion is specific, focus is visible.

```scss
.user-card {
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--duration-fast) var(--ease-standard);

  &:hover { border-color: var(--color-border-strong); }

  .title {
    font-size: var(--text-base);
    font-weight: var(--weight-semibold);
    line-height: var(--leading-snug);
    color: var(--color-text);
  }
}
```

If the project's tokens carry another prefix or other role names (for example `--ds-radius`), use those names; the pattern is the same.

## 3. CSS craft

- **Low specificity.** One class per concern, no IDs, no deep descendant chains, no `!important`. Style by class, not by tag descendants: `.person span` silently restyles every span added later (an avatar, a badge); use `.person__name`. Do not duplicate selectors; if two rules for the same selector exist, merge them. Use `@layer` (reset, tokens, base, components, utilities) in larger codebases.
- **Layout** with `display: grid` and `flex` plus `gap`, not margins on children. Use `max-width` and the container token, `minmax()`, `auto-fit` grids, and `aspect-ratio`. Use container queries for components that live in variable-width containers.
- **Shrinking and scrolling.** Grid and flex children shrink below their content only with `min-width: 0` (or `minmax(0, 1fr)` columns); without it, a wide table or code block makes the whole page scroll sideways. Wrap tables, code and diagrams in `.scroll-x` from `assets/tokens.css`: scroll containers must be `position: relative`, or visually hidden text (`.sr-only`) inside them escapes the scroller and also causes page-level horizontal scroll.
- **`[hidden]` loses to any `display` rule.** `.state { display: flex }` re-shows a `hidden` panel. Add `.state[hidden] { display: none }`, or toggle a class instead. Check every toggled state by actually switching to it.
- **Units:** `rem` for type, spacing and sizes (it follows the user's font size); `px` only for hairlines and borders; `ch` for line length; `dvh` rather than `vh` for full-height mobile layouts.
- **Type:** `text-wrap: balance` on headings, `font-variant-numeric: tabular-nums` for number columns, line length within `--container-prose`.
- **Interaction:** hover styles inside `@media (hover: hover)`; `:focus-visible` rings from the focus tokens; never `outline: none` without a replacement.
- **Color scheme:** `color-scheme` on `:root` so native controls and scrollbars match; dark values live in the token source, so components need no dark rules.
- **Logical properties** (`margin-inline`, `padding-block`, `inset-inline-start`) so right-to-left layouts work.
- **Motion:** list the animated properties, use the duration and easing tokens, wrap non-essential animation in `@media (prefers-reduced-motion: no-preference)`.
- **Native elements first:** `button`, `a`, `label`, `dialog`, `details`, `table`; reset them with tokens, never replace them with clickable `div`s.
- **SCSS:** variables and maps are build-time only. Do not use them to hold the live theme; the runtime source is CSS custom properties. Generate custom properties from a map if the project wants SCSS authoring.

## 4. Framework notes

- **Angular:** tokens in the global `styles.css` (or `styles.scss`); each component's `styleUrls` only consumes `var(--token)`. Avoid `::ng-deep`; if a library component needs a different look, use its theming API or a component token. With Angular Material, use its theme mixins for the palette and typography rather than overriding class names. Templates use native `button`/`a` with `(click)`, not clickable `div`s.
- **Vue:** scoped styles consume tokens; avoid `:deep()` into libraries; use `v-bind()` in CSS only for truly dynamic values, not for theme colors.
- **Svelte / Astro:** component styles consume tokens; pass variants through classes or data attributes, not inline colors.
- **Any framework:** state classes (`is-active`, `data-state="open"`) rather than inline style changes; one source of truth for strings if the project has i18n.

## 5. Single-file prototypes and HTML artifacts

A prototype is still a product the person will judge, so the same system applies; it just lives in one file.

- A `<style>` block at the top starts with the token block (light and dark) from `assets/tokens.css`, then a short base layer, then component styles that only use tokens.
- Include `<html lang>`, a viewport meta tag (`width=device-width, initial-scale=1`), and a meaningful `<title>`. Do not disable zoom.
- No remote images or fonts unless the environment allows them. Use the system font stack, inline SVG icons that use `currentColor`, CSS shapes, or real data and screenshots the person supplied. Never leave broken image links or placeholder boxes with "Image" in them.
- Realistic sample data in one `const DATA = ...` block or one fixtures section, including long names and an empty case. Build the loading, empty and error states and make them reachable (a state switcher in a prototype is fine).
- Keep JavaScript small and framework-free unless the task needs more. Interactive elements are real `button`s with real labels and keyboard behavior.
- Support light and dark through the token blocks, and verify at narrow widths (320px) and wide ones.
- If CDN scripts are allowed, pin an exact version.
