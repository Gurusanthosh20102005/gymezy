# Components, states and screen patterns

Stack-neutral rules for the pieces that make or break a screen. Use the project's component library for the pieces themselves (see `references/stacks/`); this file says how they should behave and be arranged.

Contents: 1 App shell and navigation · 2 Buttons and actions · 3 Forms · 4 Tables and lists · 5 Cards and sections · 6 Dialogs, drawers, popovers · 7 Feedback · 8 Status and badges · 9 Data visualization · 10 State catalogue · 11 Screen templates (login, dashboard, settings, list and detail)

## 1. App shell and navigation

- Left sidebar (220 to 260px, collapsible to icons) for apps with more than five sections; a top bar for fewer. Header holds the page area, optional global search, and the user menu on the right.
- Page content sits in a max-width container with token page padding (24px, 16px on mobile).
- Highlight the current section. At most about seven top-level items. Icons only if every item gets one and they help scanning.
- Page header: title (h1) on the left, the one primary action on the right, optional one-line description, breadcrumbs only for depth of three or more, tabs below for sub-views.
- Mobile: the sidebar becomes a drawer or a bottom bar (five items at most); the header is sticky and respects safe-area insets.

## 2. Buttons and actions

- Hierarchy: **primary** (filled, one per decision area), **secondary** (outline or default), **tertiary** (text or link), **destructive** (danger style, only for destructive actions and their confirm step).
- Label = verb + object. Width fits the label; do not stretch buttons across wide containers (full width only in narrow cards and on mobile).
- Icons only when they clarify (download, add). Icon-only buttons need an accessible name and a tooltip.
- Loading: keep the width, show a spinner, block repeat clicks. If disabled, make the reason visible nearby when it is not obvious.
- Navigation is a link, an action is a button. Do not style one as the other without keeping the semantics.
- In a group, the primary action sits at the end (right on LTR web) with Cancel before it.

## 3. Forms

- One column. Labels above inputs. Helper text under the field. Widths match the expected input (a ZIP code is not full width). Group with headings or `fieldset`/`legend`.
- Mark the exception: if most fields are required, mark optional ones "(optional)"; otherwise mark required ones.
- Validate on blur and on submit, not on every keystroke (exceptions: password strength, username availability). Put the message under the field, tied to it with `aria-describedby`, with `aria-invalid`. For long forms add a summary that links to each error. Keep what the person typed. Move focus to the first invalid field.
- Use the right control: radio or segmented control for 2 to 4 options, select for 5 to 12, searchable select or autocomplete for more, checkbox for independent yes/no, switch for immediate on/off settings.
- Use the right input type, `inputmode` and `autocomplete` (`email`, `username`, `current-password`, `new-password`, `one-time-code`, `given-name`, `street-address`). Never block paste. Offer show/hide on passwords.
- Submit button stays enabled until submitting (then loading); show errors instead of disabling it. Confirm success (inline or toast) and say what happens next.
- Warn before leaving with unsaved substantial changes. For irreversible actions, confirm or offer undo.
- Long forms: sections with headings and a sticky action bar; a wizard only when the steps are real.

## 4. Tables and lists

- Left-align text, right-align numbers (tabular numerals), consistent date, currency and unit formats (units in the header). Sticky header. Row height 40 to 48px, 32 to 36px compact. Hover highlight over zebra stripes. No vertical rules.
- Provide what the data size needs: sort on sortable columns, search and filters above the table, pagination (10 to 50 per page, server-side for large sets), bulk selection with a bulk-action bar, column visibility for wide tables.
- Row actions: one primary link in the name column, secondary actions in an overflow menu, at most two inline icon buttons with tooltips.
- Status shown as a tag with text. Long text truncates with an ellipsis and a tooltip or title. Set minimum column widths.
- Small screens: horizontal scroll inside the table's container, or switch to a card list. Never let the page scroll sideways.
- Stable row keys: the business `id`, not a database `_id` and not the index (when rows reorder).
- Empty (nothing yet) and empty (no matching results) are different messages. Loading uses skeleton rows in the table's shape. Errors appear inline with a retry.

## 5. Cards and sections

- A card bounds related content that belongs together or is independently actionable. No card around a single line of text, no card inside a card, no card per list item when a list will do.
- Consistent padding (16 to 24px). Card header (title, optional action), body, optional footer.
- Sections of a page are separated by spacing and headings, not by wrapping each one in a card.
- A clickable card is one link covering the card, with a visible focus state and a hover border or background change.

## 6. Dialogs, drawers, popovers

- **Dialog**: one short task or one confirmation. The title names the task; the primary button names the action ("Delete invoice"). Esc and a close button close it. Focus is trapped inside and returns to the trigger. No dialog opened from a dialog. On mobile, full screen or a bottom sheet.
- **Drawer**: longer forms and detail views that keep the page in context (400 to 640px wide).
- **Popover and menu**: small and contextual. **Tooltip**: short supplementary text only; never the sole place for essential information, and not reachable on touch.
- Destructive confirm: title "Delete 3 invoices?", body states the consequence and whether it can be undone, buttons "Delete invoices" (danger) and "Cancel". For low-stakes actions prefer doing it and offering Undo.

## 7. Feedback

- **Inline** next to the source for validation and field-level messages.
- **Alert or banner** for a condition that persists on the page (offline, payment failed, read-only mode).
- **Toast** for brief confirmation of something the person just did (3 to 5 seconds, announced politely to screen readers). Never use a toast for an error that needs action, and never auto-dismiss an error the person must read. No more than three stacked.
- Progress: determinate when you know it; skeletons for the first load, spinners for small areas; optimistic updates with rollback for fast, low-risk actions.

## 8. Status and badges

- A small fixed vocabulary mapped to semantic colors: Active (success), Pending (warning), Failed (danger), Draft (neutral), Info (info). The label is always text.
- One shape and size across the product. Do not use ten colors to categorize; do not use status colors for decoration.

## 9. Data visualization

- Pick by question: trend, line; comparison, bar (zero baseline); part of whole, stacked bar or a donut with five slices or fewer; distribution, histogram. No 3D, no dual axes, no pie with many slices.
- Color: one hue ramp for magnitude; at most six categories, distinguished also by direct labels or shape; grey for context and brand color for the focus series; status colors only for status.
- Always: title, units, labeled axes, direct labels in preference to a legend, tooltips with exact values, empty/loading/error states, and a text or table alternative.
- Light gridlines, no gradient fills, animate only on first draw and respect reduced motion.

## 10. State catalogue

| State | Show | Copy pattern |
|---|---|---|
| Loading, first load | Skeleton in the final layout's shape | none |
| Loading, action | Spinner in the button or inline progress | "Saving..." |
| Empty, first use | One line on what belongs here and the primary action | "No projects yet. Create a project to start tracking work." |
| Empty, no results | What was searched, and a clear-filters action | "No results for 'invoice 204'. Clear filters" |
| Error, recoverable | Inline alert with a retry | "Couldn't load invoices. Check your connection and try again." |
| Error, forbidden or not found | A result page with the next step | "You don't have access to billing. Ask an admin to grant access." |
| Success | Toast or inline, past tense | "Changes saved" |
| Disabled | Reduced emphasis, and the reason nearby if unclear | "Select at least one item to export" |
| Offline or degraded | Persistent banner | "You're offline. Changes will sync when you reconnect." |

Also design: long text and unbroken strings, 0, 1 and many items, very large numbers, missing optional data, and permission differences between roles.

## 11. Screen templates

**Login.** A single card (max about 400px) centered on the neutral page background. Product name or logo, a plain title ("Sign in"), no marketing copy. Fields: email (`type="email"`, `autocomplete="username"`), password (`autocomplete="current-password"`, show/hide). "Forgot password?" link next to the password field. One full-width primary "Sign in" button with a loading state. SSO buttons below an "or" divider only if they exist. A link to create an account. Errors: field messages under fields; a credentials error is generic ("Incorrect email or password."). No prefilled demo credentials, no blocked paste, no CAPTCHA unless required.

**Dashboard.** Lead with what needs attention or what the person does first each day. At most four summary figures, each with a label, a value, a comparison to the previous period (direction shown in text and icon, not color alone) and a link to detail. One time-range control that governs the page. One primary chart or table, then supporting items. Skeletons per tile. No decorative widgets and no greeting banner.

**Settings.** Left section list or tabs. Each section: a heading, a one-line description, grouped fields, and its own Save (or autosave with a visible "Saved"). A separate "Danger zone" at the bottom for destructive actions, each with a named confirm.

**List page.** Page header with the primary create action, then search and filters, then the table (section 4), pagination at the bottom, and the empty, loading and error states.

**Detail page.** Header with the entity name, status tag and main actions; a summary block of key fields (definition list); tabs or sections for related data; activity or history last. Breadcrumb back to the list.
