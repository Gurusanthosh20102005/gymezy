# Accessibility and responsive baseline

This is the quality floor for every screen, not an extra pass. It targets WCAG 2.2 level AA, which is also what most procurement and legal requirements reference. Following it makes the UI better for everyone: keyboard users, people on phones in sunlight, people zoomed in, and anyone in a hurry.

Contents: 1 Contrast and color · 2 Focus and keyboard · 3 Semantics and names · 4 Forms · 5 Touch and pointer · 6 Motion · 7 Responsive layout · 8 Test matrix

## 1. Contrast and color

- Normal text 4.5:1 against its background; large text (24px, or 18.66px bold) 3:1; icons, control borders, focus rings and chart marks 3:1.
- Placeholder, helper and caption text are text: they need 4.5:1 too. Only disabled controls are exempt.
- Never use color as the only signal. Pair status color with text or an icon; mark links in body text with an underline or another cue; show form errors with a message, not only a red border.
- Check pairs, including the ones in dark mode: `python scripts/audit_ui.py --contrast FG BG`.
- Do not put text over images without a solid or scrimmed layer behind it.

## 2. Focus and keyboard

- Every interactive element is reachable and operable by keyboard, in a logical order that follows the visual order. No positive `tabindex`.
- A visible focus indicator on everything focusable: at least 2px, 3:1 against adjacent colors, offset from the element. Use `:focus-visible` so it shows for keyboard users. Removing `outline` is allowed only if a replacement is in the same rule.
- Focus is never hidden under a sticky header or footer; use `scroll-padding-top` to account for them.
- Dialogs trap focus, close on Esc, and return focus to the trigger. The native `<dialog>` with `showModal()` does all of this.
- Provide a "Skip to content" link on pages with significant navigation.
- Custom widgets (tabs, menus, comboboxes) follow the WAI-ARIA Authoring Practices keyboard patterns, or use the library's accessible component instead of building one.

## 3. Semantics and names

- Native elements first: `button` for actions, `a href` for navigation, `input`/`select`/`textarea` with `label`, `table` with `th scope`, `ul`/`ol` for lists, `nav`, `main`, `header`, `footer`, `aside` landmarks, `dialog` for dialogs, `details`/`summary` for disclosures.
- Never attach `onClick`, `role="button"` or `tabindex` to a `div` or `span` to make a button. Give every `button` an explicit `type` (`button`, `submit`).
- Headings are in order (one `h1`, then `h2`, no skipped levels), chosen for structure and styled with CSS.
- Every control has an accessible name: a visible `label`, or `aria-label` for icon-only buttons (with a tooltip for sighted users).
- Images: informative images get specific alt text; decorative images get `alt=""`; icons inside a labeled button are `aria-hidden`.
- Links say where they go ("View invoice 204"), not "Click here".
- ARIA only where native HTML cannot express it. The first rule of ARIA is not to use it when a native element will do. Announce dynamic changes with `role="status"` or `aria-live="polite"` (toasts, "Saved"), and `role="alert"` only for urgent errors.
- Set `lang` on the `html` element.

## 4. Forms

- Visible label for every field (a placeholder is not a label). Related fields grouped with `fieldset` and `legend`.
- Error text is associated with its field (`aria-describedby`), the field has `aria-invalid="true"`, and the error says what to fix. Move focus to the first error after a failed submit.
- Mark required fields in text, not only with a color or an asterisk without explanation.
- Use `autocomplete` and the right `type` so browsers and password managers can fill the form. Do not block paste. Do not require remembering or transcribing a value to authenticate (WCAG 3.3.8).
- Do not make people retype information they already gave in the same flow.

## 5. Touch and pointer

- Targets: at least 24 by 24 CSS px on desktop (WCAG 2.2 AA minimum) and 44 by 44 on touch (Apple 44pt, Material 48dp). Space adjacent targets apart. A small icon can have a larger invisible hit area.
- Hover is an enhancement: never the only way to reveal an action or information. Wrap hover styles in `@media (hover: hover)`.
- Do not depend on gestures (swipe, drag, long press) without a visible alternative.

## 6. Motion

- Respect `prefers-reduced-motion: reduce`: remove parallax, large movement and auto-playing animation; keep short fades if they carry meaning.
- Nothing flashes more than three times per second.
- Auto-playing or moving content that lasts more than five seconds can be paused.
- Loading and progress indicators are exposed to assistive tech (`role="progressbar"` with values, or `aria-busy`).

## 7. Responsive layout

- **Mobile first.** Write the narrow layout, then widen with `min-width` media queries at the breakpoints from the token scale (480, 768, 1024, 1280, 1536).
- **No horizontal page scroll** at 320 CSS px wide (WCAG reflow). Wide content (tables, code, diagrams) scrolls inside its own container. Measure it rather than eyeballing: `document.documentElement.scrollWidth - document.documentElement.clientWidth` must be 0 (`scripts/render_check.py` reports it at 320, 768 and 1280).
- **Fluid over fixed**: `max-width` plus percentage or `fr` widths, not fixed pixel widths of 640px or more. Use `rem` for type and spacing so they follow the user's font size; `px` for hairlines and borders.
- Text can be zoomed to 200% and spacing overridden without loss of content or function.
- **Patterns by width**: sidebar becomes a drawer or bottom bar; multi-column forms stack to one column; tables scroll or become cards; button groups wrap or stack; dialogs go full screen or become bottom sheets; hero and display type scale down (`clamp()` is fine for marketing pages).
- Use `dvh` instead of `vh` for full-height mobile layouts, `env(safe-area-inset-*)` with `viewport-fit=cover` for notches and home indicators, and `aspect-ratio` to reserve space for media (no layout shift).
- Never disable zoom (`user-scalable=no`, `maximum-scale=1`).
- Images: `max-width: 100%`, intrinsic `width`/`height` attributes, `loading="lazy"` below the fold, `srcset` for large images.

## 8. Test matrix

Run through this before declaring a screen done. Do the parts you can in code (audit script, resizing, reading the markup) and say what you could not verify.

| Check | How |
|---|---|
| Widths 320, 375, 768, 1024, 1440 | Resize, or run `scripts/render_check.py`; no horizontal scroll, nothing clipped, targets still usable |
| Keyboard only | Tab through the whole screen; focus always visible; no traps; Esc closes overlays |
| Zoom 200% | Layout reflows, nothing overlaps |
| Dark mode (if supported) | Every text pair re-checked; images and shadows still work |
| Reduced motion | No essential motion lost; no large movement |
| Long text, 0 / 1 / many items | Truncation, wrapping, empty state, pagination |
| Screen-reader names | Every control, image and icon-only button has a name; headings and landmarks make sense |
| Slow or failed network | Loading and error states appear and recover |
