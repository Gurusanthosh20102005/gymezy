# Tailwind CSS, shadcn/ui and Radix

Applies the ten rules to utility-class projects. Tailwind makes it easy to write a literal in every class name, so the discipline here is to keep decisions in the theme and use semantic utilities.

Contents: 1 Tokens live in the theme · 2 Semantic utilities · 3 Classes and components · 4 shadcn/ui · 5 Things to avoid · 6 Accessibility and responsive with utilities

## 1. Tokens live in the theme

- Tailwind v4: define tokens in CSS with `@theme` (`--color-*`, `--font-*`, `--radius-*`, `--spacing`, ...). Tailwind v3: `theme.extend` in `tailwind.config`. Look at which the project uses before editing.
- Back colors with CSS variables so dark mode is a remap, and name them by role, not hue. If the project has none, start from `assets/tokens.css` and expose its roles to Tailwind (`--color-primary`, `--color-surface`, `--color-text-muted`, ...).
- One brand color, neutrals, and status colors. Do not leave the whole default palette in play as an invitation to use `indigo-500`, `pink-600` and `emerald-400` on one page.
- Fonts, radii and shadows come from the theme as well. Change them there.

## 2. Semantic utilities

Use role names, not raw palette steps.

| Write | Not |
|---|---|
| `bg-background text-foreground` / `bg-surface text-text` | `bg-white text-slate-900` |
| `text-muted-foreground` / `text-text-muted` | `text-gray-500` |
| `border-border` | `border-gray-200` |
| `bg-primary text-primary-foreground hover:bg-primary/90` | `bg-blue-700 text-white hover:bg-blue-800` |
| `text-destructive`, `bg-destructive/10` | `text-red-600`, `bg-red-50` |
| `rounded-md` (the theme's default radius) | `rounded-[7px]`, `rounded-3xl` on everything |
| `p-4 gap-6` (spacing scale) | `p-[13px]`, `gap-[22px]` |

Arbitrary values (`bg-[#1e293b]`, `text-[13px]`, `w-[317px]`, `rounded-[11px]`, `p-[13px]`) mean a token is missing: add it to the theme and use the named utility. Arbitrary values for one-off layout math (`grid-cols-[1fr_auto]`, `max-w-[calc(100%-2rem)]`) are fine.

Let the dark variant come from the variables, not from `dark:` on each element. Use `dark:` only for the few cases a token cannot express.

## 3. Classes and components

- Extract a component once a pattern appears three times (button, input, card header). Put the variants in the component with `cva` (class-variance-authority) and merge with a `cn()` helper (`clsx` plus `tailwind-merge`) so call sites pass props, not 15 classes.
- Class order is consistent (layout, box, typography, color, state). Use the Prettier Tailwind plugin if the project has it.
- Layout uses `flex`, `grid`, `gap-*` and container widths from the theme. Mobile first: base classes for narrow screens, `md:` and `lg:` to widen.
- Keep spacing rhythm: use gap and padding from the scale, and group related items with smaller gaps than between groups.

## 4. shadcn/ui

- shadcn/ui components are copied into the project and styled with CSS variables (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`). Change the look by editing those variables and the component's `cva` variants, never by piling classes on at call sites.
- Use its `Button`, `Input`, `Select`, `Dialog`, `Sheet`, `DropdownMenu`, `Table`, `Form`, `Tabs`, `Toast`/`Sonner`, `Skeleton`, `Alert` before writing your own. They build on Radix primitives, which already handle focus, keyboard and ARIA.
- Compose from them; if you must change a component's internals, edit the component file once for everywhere.
- Use `lucide-react` (or the project's icon set) at one stroke width and the sizes from the scale; icons inherit `currentColor`.

## 5. Things to avoid

- `bg-gradient-*`, `bg-linear-*`, `from-*`/`via-*`/`to-*` color stops, `bg-clip-text text-transparent` (gradient text).
- `backdrop-blur-*` as decoration, `shadow-2xl`, colored shadows (`shadow-purple-500/50`), large `blur-*` blobs.
- `animate-pulse`, `animate-bounce`, `hover:-translate-y-1` on every card; `transition-all`.
- `uppercase tracking-widest` labels above every heading.
- `outline-none` without `focus-visible:ring-*` (or `focus-visible:outline-*`) in the same class list.
- Very large radii (`rounded-2xl`, `rounded-3xl`) on cards, inputs and buttons together.
- `z-[9999]`; use named z-index tokens.

## 6. Accessibility and responsive with utilities

- Focus: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` on custom interactive elements.
- Hidden labels: `sr-only`. Reduced motion: `motion-reduce:transition-none motion-reduce:animate-none`.
- Touch targets: `min-h-11 min-w-11` (44px) on touch UIs, `h-9` (36px) is fine for dense desktop controls.
- Tables and code blocks: wrap in `overflow-x-auto`. Containers: `mx-auto w-full max-w-7xl px-4 md:px-6`.
- Do not use `div` with click handlers for buttons; the framework's components or native `button` come first.
