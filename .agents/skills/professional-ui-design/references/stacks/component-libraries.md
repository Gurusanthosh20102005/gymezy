# MUI, Mantine, Chakra and other component libraries

The rules are the same as for Ant Design: the library already solves buttons, inputs, dialogs, tables, focus and keyboard, so the job is to configure it once and compose with it. Check the installed version's docs for exact API names, because theming APIs change between major versions.

Contents: 1 The one-theme rule · 2 Per library · 3 Composition · 4 Avoid

## 1. The one-theme rule

- There is exactly one theme object, created in one file and provided at the app root. Brand color, neutrals, status colors, typography, shape (radius), spacing unit, and default component props are set there and nowhere else.
- Components receive their look from the theme. A color, size or radius written in a component (`sx={{ color: '#1976d2' }}`, `style={{ borderRadius: 7 }}`) means a theme value is missing: add it to the theme and reference it by name.
- Start values from `assets/tokens.css` (brand, text and surface roles, radius, type scale) and keep the theme object as the single owner afterwards.
- Dark mode uses the library's mechanism, not duplicated styles.
- Restyle a component for the whole app through the theme's component overrides or default props, not per call site.

## 2. Per library

**MUI.** One `createTheme({ palette, typography, shape, spacing, components })` passed to `ThemeProvider`, with `CssBaseline` for the reset.
- `palette`: `primary.main` (the brand color), neutral `grey`/`background`/`text`, and `success`, `warning`, `error`, `info`; `mode: 'dark'` for dark.
- `typography.fontFamily` and a short set of variants; `shape.borderRadius` as the one base radius; `spacing: 8` (or 4) as the unit.
- `components`: `MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { textTransform: 'none' } } }` removes the default ALL CAPS and shadow once for the app. Do the same for `MuiTextField`, `MuiCard`, `MuiTableHead`.
- `sx` is for small layout adjustments. Use theme keys in it (`color: 'text.secondary'`, `p: 2`, `borderRadius: 1`), never literals. Prefer `Stack`, `Grid`, `Box` for layout.

**Mantine.** One `createTheme({ primaryColor, fontFamily, defaultRadius, spacing, components })` passed to `MantineProvider`. Set `components: { Button: Button.extend({ defaultProps: {...} }) }` for app-wide defaults. Use `Stack`, `Group`, `Grid`, `Container` for layout and style props that read theme values.

**Chakra.** One theme or system config at the root (the API differs: v2 uses `extendTheme`, v3 uses `createSystem` with `defineConfig`). Define tokens and semantic tokens (light and dark values together), then use semantic token names in components.

**Others** (Radix Themes, Headless UI, Angular Material, Vuetify, PrimeVue, Quasar). Same pattern: find the one theming entry point (a theme object, a Sass or CSS-variable config, or a theming mixin) and use it. For Angular Material, use its theming API and avoid `::ng-deep` overrides. For headless libraries, style with the project's tokens.

## 3. Composition

- Build pages from library layout components (`Stack`, `Grid`, `Group`, `Flex`, `Box`), not hand-written flex/grid CSS.
- Wrap a library component in a project component only to give it a reusable variant or default (a `PageHeader`, a `StatusChip`, a `ConfirmDialog`), with props and states. Do not clone a library component's markup.
- Forms: the library's form components, labels above inputs, helper and error text wired through the library's props, one primary submit with a loading state.
- Tables: the library's table or data-grid component with server pagination for large data, sticky header, and the empty/loading/error states from `references/components-and-states.md`.
- Use the library's icon package at one style and size scale.

## 4. Avoid

- A second UI library or icon set for one component.
- Overriding internal class names (`.MuiButton-root`, `.mantine-Button-root`) or using `!important`.
- Raw hex values in `sx`, `style` or CSS modules next to a themed component.
- Default ALL CAPS buttons, elevation shadows on every card, and the library's default demo palette shipped unchanged (the "default MUI blue" look is itself a tell).
