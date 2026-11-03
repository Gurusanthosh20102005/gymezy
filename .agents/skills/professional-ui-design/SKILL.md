---
name: "professional-ui-design"
description: 'Professional, human-designed UI standard for ANY interface work in ANY stack (React, Next.js, Vue, Angular, Svelte, Flutter, plain HTML/CSS/SCSS, Tailwind, Ant Design, MUI, shadcn/ui). Replaces generic AI-generated looks with a token-driven design system, restrained palette, clear hierarchy, consistent spacing and type, complete loading/empty/error states, plain microcopy and accessibility. Use this skill EVERY time a task creates, edits, styles, redesigns, reviews or polishes anything a person will see: pages, screens, dashboards, forms, tables, modals, navigation, landing pages, components, themes, CSS, mockups, prototypes, HTML artifacts. Trigger even if the user never says "design" or "professional" (e.g. "build a login page", "add a settings screen", "style this table", "make it look better"). Read it before writing any markup or styles; run its audit before delivering. Do NOT use for copying, extracting or documenting existing CSS from a website as-is.'
compatibility: 'Works in any stack. scripts/audit_ui.py needs Python 3.8+ (standard library only). scripts/render_check.py is optional and needs playwright with Chromium.'
---

# Professional UI Design

The target is an interface a real product team would ship: calm, consistent, legible and purposeful, in whatever framework the project uses.

Generated UI gives itself away through *unchosen defaults*: a gradient hero, emoji for icons, a grid of identical icon cards, three accent colors, hex values hardcoded in every file, and no loading or empty states. This skill replaces those defaults with a small system and a checklist, so the first draft is already presentable and nobody has to ask for "make it look professional".

**Out of scope:** copying or documenting someone else's existing CSS exactly as found (for example, font rules taken from DevTools). Keep those values verbatim; don't tokenize, normalize or audit them.

**Precedence when guidance conflicts:** the user's explicit request or brand, then the project's existing design system and profile, then this skill's defaults. If an explicit request would break accessibility, do what was asked and say so in one line.

## Workflow

Follow in order. Steps 1 to 3 are quick reading and setup, and they matter most: they are what makes ten screens look like one product instead of ten styled pages.

1. **Discover first.** Look at what already exists before designing anything:
   - a project profile (`DESIGN.md`, `design-system.md`, `docs/ui.md`; template in `assets/DESIGN.template.md`),
   - the stack and component library (package.json, pubspec.yaml, angular.json, tailwind config),
   - the token or theme source (`tokens.css`, `:root` in `styles.css`, `_variables.scss`, a theme file, `app_theme.dart`),
   - existing screens, whose patterns you copy.

   Match what exists. Never add a second UI library, icon set or visual language. With no project at all (a chat request, a prototype), say so in a line and use the defaults here.
2. **Pick the archetype** from the table below. It sets density, personality and how much visual expression is appropriate.
3. **Lock the tokens before any component.** Reuse the project's tokens. If there are none, create one token source from `assets/tokens.css` (or the stack equivalent in `references/stacks/`) with the brand color swapped in. If a needed value is missing, add it to the token source first, then reference it. Details: `references/design-tokens.md`.
4. **Compose.** Use the stack's component library, lay out on a grid, and build every state (rule 8). Read the matching file in `references/stacks/`, and `references/components-and-states.md` for the pattern you are building (forms, tables, dialogs, login, dashboard, settings).
5. **Write the words.** Labels, buttons, errors, empty states and sample data are part of the design: `references/microcopy.md`.
6. **Verify.** Run `python scripts/audit_ui.py <files-or-folder>` on what you touched (paths are relative to this skill's folder). If you can render the page, also run `python scripts/render_check.py <page.html or URL> --dark` and look at the screenshots. Fix errors, fix or justify warnings, then walk the checklist at the end.
7. **Report briefly**, in 2 to 4 lines: the system you used or created, assumptions you made (brand color, archetype), and anything deliberately off-standard. Do not narrate this skill.

Ask the user a question only when it blocks the work (for example, a full product with no brand color and no existing UI). Otherwise proceed with the defaults and say they can be swapped in one place.

## The ten rules

1. **Tokens, never literals.** Every color, font size, space, radius, shadow, duration and z-index comes from the token source (CSS variables, theme object, `ThemeData`). Literals scattered through components are how a product drifts into fourteen slightly different greys, and why one brand change touches forty files. Raw values live only in the token source.
2. **One brand color on neutrals.** Pages are neutral. The brand color marks the primary action, selection, links and focus. Success, warning, danger and info colors appear only when they mean that status, and never alone (add text or an icon). If you cannot say what job a color does on this screen, remove it: color is the strongest hierarchy signal, and spending it everywhere cancels it.
3. **One type family, a short scale, sentence case.** One family (system stack or brand font). A defined scale of 6 to 8 sizes for the whole product and no more than three weights (400, 500, 600). Body 14 to 16px with line-height 1.4 to 1.6, headings 1.15 to 1.3, line length 45 to 75 characters, tabular numerals for number columns. Sentence case ("Add user"), not Title Case or ALL CAPS.
4. **Spacing from a 4px scale, grouped by proximity.** Space inside a group is smaller than space between groups; that difference is how people read structure. Same page padding, same section rhythm, aligned left edges on every screen. Odd values (13px, 22px) are the quickest sign that nothing is systematic.
5. **One focal point, one primary action.** Each decision area has one filled primary button; the rest are secondary, outline or text. Build hierarchy with size, weight and contrast, not by adding colors or effects. The danger style is for destructive actions, not for a default primary.
6. **Use the library, do not rebuild it.** Buttons, inputs, selects, tables, dialogs, menus, tabs, forms and toasts come from the project's component library, with free accessibility and states. Wrap them for reusable variants; do not restyle internals with `.ant-*` or `::ng-deep` overrides or `!important` (they break on upgrade). With no library, build on native elements (`button`, `input`, `dialog`, `details`) styled with tokens, never `div` buttons.
7. **Quiet surfaces.** Flat neutral surfaces, separated by spacing and 1px borders before shadows. At most three elevation levels (the highest for overlays). One base radius with at most one smaller and one larger step. No gradients (except functional ones such as an image scrim or a skeleton shimmer), glassmorphism, glows, colored shadows, decorative blobs or gradient text. Cards group related content: no cards inside cards, and not every element is a card.
8. **Every screen handles every state.** Default, hover, focus-visible, active, disabled, loading (skeleton for content, spinner for small areas), empty (say what is missing and offer the next action), error (what happened, how to fix it, a retry), success. Also long text, 0, 1 and many items, slow or failed requests, and missing permission. Real products live in these states; skipping them is the fastest way for a screen to feel like a mockup.
9. **Words are part of the UI.** Plain, specific, verb-led: "Save changes", "Invite member", "No invoices yet". The same action keeps the same name everywhere (button "Publish", toast "Published"). Errors say what happened and what to do: no "Oops", no apologies, no exclamation marks, no hype, no lorem ipsum. Sample data is realistic and domain-specific, never "John Doe", "Acme Inc" or invented stats and testimonials. Strings come from the project's message catalog when it has one. Prototype data lives in fixtures, never as a fallback in production code (`user?.name || 'Admin'` is a bug).
10. **Accessible and responsive by default.** This is the quality floor, not a bonus pass. Text contrast of at least 4.5:1 (3:1 for large text and control borders). A visible `:focus-visible` indicator, never removed without a replacement. Everything operable by keyboard. Native semantic elements. A label on every input and every icon-only button. Touch targets of at least 44px on touch UIs (24px is the desktop minimum). `prefers-reduced-motion` honored. Works from 320px wide with no horizontal scroll. Zoom never disabled. Details: `references/accessibility-responsive.md`.

## Archetypes

| Archetype | Use for | Character |
|---|---|---|
| **App UI (dense)** | admin panels, dashboards, internal tools, B2B SaaS | Efficient and neutral. 14px base, 32 to 36px controls, tables and filters. No hero art. Restraint matters most here; effort goes into alignment, scanning and states. |
| **Consumer app** | booking, finance, social, utilities | Friendlier. 16px base, 40 to 48px controls, more whitespace, brand color a little more present. Imagery only from real content. |
| **Marketing / landing** | product sites, campaigns, portfolios | The most expressive: large type, strong rhythm, one memorable idea built from the product's real content (real screenshots, real numbers). The quality floor still applies. If a `frontend-design` skill is available, let it lead the visual identity. |
| **Content / docs** | blogs, documentation, help centers | Typography is the design: 17 to 19px text, 60 to 75ch measure, quiet chrome. |
| **Native mobile** | iOS, Android, Flutter, React Native | Platform conventions first: safe areas, 44/48 targets, system text scaling, bottom navigation. |

## What generated UI looks like (avoid)

- Gradients on heroes, buttons or headlines, especially purple to blue or pink to orange.
- Three or more accent colors; every card in its own hue.
- Glass blur, neon glow, large colored shadows, background blobs, dot or noise patterns.
- Emoji or sparkle/robot "AI" icons; an icon in a tinted circle on every card and heading.
- The stock page: pill badge, two-line headline with one colored word, subtitle, two buttons, a row of "10K+ users / 99.9% uptime", then three identical icon cards.
- Cards in cards, with one big radius and the same soft shadow on everything.
- ALL-CAPS tracked eyebrows over every heading, 01/02/03 numbering for non-sequences, middle-dot meta strings, a "→" on every link.
- Fade-up on every section and hover-lift on every card.
- Hype copy, lorem ipsum, invented numbers and testimonials.
- Only the happy path: no loading, empty or error states, dead `href="#"` links.
- Literal hex values, px sizes and `!important` scattered through components.

These are defaults, not crimes: they become wrong when nobody chose them. If the brief or brand calls for one, use it on purpose as the single expressive element and keep everything around it quiet. Full catalogue with replacements: `references/ai-tells.md`.

## Stack guide

Read the file that matches the project. Combine when needed (Next.js with Tailwind and shadcn/ui: `tailwind-shadcn.md` plus the token layer in `web-css.md`).

| The project uses | Read |
|---|---|
| React + Ant Design | `references/stacks/react-antd.md` |
| Tailwind CSS, shadcn/ui, Radix | `references/stacks/tailwind-shadcn.md` |
| MUI, Mantine, Chakra, other component libraries | `references/stacks/component-libraries.md` |
| Plain HTML/CSS/SCSS, Angular, Vue, Svelte, Astro, single-file prototypes and HTML artifacts | `references/stacks/web-css.md` |
| Flutter | `references/stacks/flutter.md` |
| SwiftUI, Jetpack Compose, React Native, or anything not listed (includes a recipe for finding any stack's theme mechanism) | `references/stacks/mobile-native.md` |

## Verify

Two scripts, run from this skill's folder. They check different things, so use both when you can.

```bash
# 1. Static audit: patterns visible in the code (standard library only)
python scripts/audit_ui.py src/                              # a folder, or specific files
python scripts/audit_ui.py --contrast "#5b6574" "#ffffff"    # check one color pair
python scripts/audit_ui.py --rules                           # list every check

# 2. Render check: what the person actually sees (optional; needs playwright and Chromium)
python scripts/render_check.py index.html --dark --select "#state=loading"
```

**`audit_ui.py`** flags hardcoded colors, sizes and radii, gradients, glass and glow, emoji, `!important`, removed focus outlines, images without alt text, clickable `div`s, dead links, low-contrast pairs written in the same rule, hype copy, placeholder data and hardcoded fallback identities, and sprawl (too many fonts, sizes, radii or colors). Errors must be fixed. Warnings are fixed, or kept on purpose with a comment such as `/* audit-ignore: gradient (image scrim) */` on the same or previous line. Info items are advisory. It cannot see through CSS variables or judge layout.

**`render_check.py`** loads the page at 320, 768 and 1280px (plus dark mode and any state you choose with `--select`), saves screenshots, and measures horizontal overflow, real rendered contrast, tap targets under 24px, controls with no accessible name, and text under 12px. It exists because some of the commonest bugs (a sideways-scrolling page, a hidden state that still shows, clipped text) are invisible in source. After it runs, open the screenshots and judge hierarchy, spacing and states yourself: no script judges taste.

If Python or a browser is unavailable, work through the checklist by hand and say what you could not verify.

## Final checklist

- [ ] No literal colors, sizes, radii, shadows or z-indexes outside the token source.
- [ ] One brand color on neutrals; status colors only for status, never alone.
- [ ] One type family; sizes and weights from the scale; sentence case.
- [ ] Spacing on the scale; related items grouped; one primary action per area.
- [ ] Standard elements come from the project's component library (or native elements); no overrides of library internals.
- [ ] No gradients, glass, glow, colored shadows, emoji icons or nested cards.
- [ ] Loading, empty, error and success states exist; long text and 0/1/many items handled.
- [ ] Copy is plain, specific and verb-led; sample data is realistic; no hype or placeholders.
- [ ] Contrast, visible focus, keyboard path, labels, alt text and semantic elements verified.
- [ ] Checked at 320, 768 and 1280px or wider; no horizontal scroll; reduced motion respected.
- [ ] Dark mode (if the project has it) works by remapping tokens, not by duplicate styles.
- [ ] `audit_ui.py` reports no errors (and `render_check.py` is clean when a browser is available), and every remaining warning is fixed or deliberately justified.

## Working with other skills

- **`frontend-design`** (if available): for brand-led pages (marketing, portfolios, campaign sites) let it direct the visual identity while this skill keeps the floor (tokens, contrast, states, copy, restraint). For product UI this skill leads, because expressiveness there is a risk, not a feature.
- **Architecture, folder-structure, state-management, API and security skills:** follow them for where files live, naming and data flow. This skill covers how the UI looks and behaves.
- **A single-source-of-truth skill:** consistent with rules 1 and 9. Tokens and messages are each defined once, in one owner.
