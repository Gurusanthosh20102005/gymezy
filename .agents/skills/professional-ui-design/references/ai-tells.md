# The generated look: tells and replacements

Read this when reviewing a screen that "looks AI-made", or before designing a page type that is prone to it (landing page, dashboard, login, pricing).

A tell is a default applied without a decision. Each row says what gives it away and what to do instead. If the brief, brand or user asks for one of these, use it deliberately and make it the only expressive element on the page.

Contents: Color and surfaces · Typography · Layout and structure · Icons and imagery · Motion · Copy and data · Interaction and states · Code-level tells

## Color and surfaces

| Tell | Why it reads as generated | Instead |
|---|---|---|
| Purple-to-blue or pink-to-orange gradient on hero, buttons or headline | The most common AI palette; says "template" before anything is read | Solid brand token. Gradients only as an image scrim for text legibility or a skeleton shimmer |
| Four or more saturated hues on one screen, each card its own color | Color stops meaning anything | One brand color on neutrals; status colors only for status |
| Glassmorphism, neon glow, large colored shadows | Decoration standing in for hierarchy; hurts legibility and performance | Flat surface, 1px border, `shadow-sm` |
| Everything very rounded (large radius on cards, buttons, inputs, images) | One value applied without regard for size or role | One base radius (6 to 8px), a smaller step for tags, a larger one for modals, pills only for avatars and tags |
| Near-black page with a single acid-green or vermilion accent as the default "modern" look | A trending default, not a choice made for this subject | Derive the palette from the brand and the audience. For product UI, neutral light with a dark mode |
| Cream background with a high-contrast serif headline and terracotta accent as the default "editorial" look | Same: a default cluster | Use it only when the brief is genuinely editorial, and then commit to the whole system |
| Light-grey body text on white (`#94a3b8` on `#fff` is 2.56:1) | Looks refined, fails AA | Text tokens that reach 4.5:1 |
| Decorative blobs, dot grids, noise textures, floating shapes | Fills space instead of structuring it | Remove. Use whitespace and a real image or screenshot if the page needs imagery |
| Page sections alternating random background bands | Divides content without meaning | One page background; separate sections with spacing and a divider where needed |

## Typography

| Tell | Why | Instead |
|---|---|---|
| One word of the headline in a different color, italic or gradient ("Build **faster**") | The signature generated headline | Plain headline; emphasis through size and weight of the whole line |
| Tracked-out ALL-CAPS label above every heading | Template chrome; adds a layer of noise to every section | Drop it. Keep a label only when it carries information (a category, a status) |
| Five or six weights, tight tracking on everything | No hierarchy; everything shouts | Three weights, tracking untouched except slightly tighter on display sizes |
| More than eight font sizes, or sizes that differ by 1px | Nothing is systematic | A scale of 6 to 8 steps from the token source |
| Centered paragraphs and long lines (over 80 characters) | Hard to read | Left-align body text; 45 to 75 characters per line |
| Monospace font for small decorative labels | Costume "technical" feel | Monospace only for code, IDs and tabular data |
| Huge stat numerals with tiny captions ("10K+ Users, 99.9% Uptime") when there are no real numbers | Invented proof | Real numbers with a source, or no stat row |

## Layout and structure

| Tell | Why | Instead |
|---|---|---|
| Centered hero: badge pill, two-line headline, subtitle, two buttons, screenshot | The default landing layout | Lead with the product's real content or the user's first task: a live demo, a real screenshot, the actual form |
| Row of three identical cards, each with an icon in a tinted circle, a title and two lines | Content chopped to fit a grid | Let the content decide the structure: a list, a table, a two-column comparison, unequal widths by importance |
| Numbered 01 / 02 / 03 on things that are not a sequence | Numbering is information about order | Number only real steps |
| Everything in a card, cards in cards, every box with border and shadow | Boxes replace hierarchy | Group with spacing and headings; use a card only to bound related, actionable content |
| The stock dashboard: sidebar, "Welcome back, Sam" with a wave, four KPI cards, one line chart, a table | Built from a template, not from the user's job | Start from what needs attention or what the user does first each day. Four KPIs at most, each linking to detail |
| Huge padding everywhere on a data-heavy screen, or dense blocks with no grouping | Density not matched to the task | App UI: compact controls, clear groups. Marketing: generous space |
| Footer with four columns of invented links, logo strip of invented companies, fake testimonials | Filler that implies credibility | Omit, or use real content |

## Icons and imagery

| Tell | Why | Instead |
|---|---|---|
| Emoji as icons, bullets or status; sparkle, robot or wand icons for "AI" | Marks the page as generated | One icon set, one style (outlined or filled), functional icons only |
| An icon beside every heading, label and button | Decoration; dilutes the icons that matter | Icons for actions, status and navigation only; text-only primary buttons |
| Abstract gradient-mesh or 3D-blob illustrations, random stock photos | Unrelated to the product | Real screenshots, product data, diagrams that explain; or nothing |
| Avatars with invented faces and names | Obvious placeholder | Initials avatars; real data |
| Mixed icon sizes and stroke weights | Icons from different sets | One set, sizes from the token scale (16, 20, 24), icons inherit text color |

## Motion

| Tell | Why | Instead |
|---|---|---|
| Fade-and-slide-up on every section as it scrolls into view | The default generated "polish" | At most one orchestrated entrance (page load or first reveal) |
| Hover lift with a bigger shadow on every card | Reads as a template | A border or background change on hover; lift only for draggable things |
| Looping bounce, pulse or float animations | Distracting; costs battery | Motion that answers an action: open, expand, confirm. 120 to 240ms |
| `transition: all` | Animates properties you did not intend, and janks | List the properties (`color, background-color, box-shadow, transform`) |
| No reduced-motion handling | Fails users with vestibular disorders | `@media (prefers-reduced-motion: reduce)` disables non-essential animation |

## Copy and data

| Tell | Why | Instead |
|---|---|---|
| "Welcome to the future of...", "Supercharge", "Unleash", "Seamless", "Effortless", "Elevate your workflow" | Says nothing | State what it does: "Track invoices and send reminders" |
| Exclamation marks, emoji in headings, "Oops!", "Awesome!" | Overfamiliar tone; undermines errors | Calm, specific sentences |
| "Submit", "Click here", "Learn more", "Get started" on every button | No information | Verb and object: "Save changes", "Invite member", "View invoice" |
| "Something went wrong." | Gives the person nothing to do | "Couldn't save changes. Check your connection and try again." |
| Title Case On Every Label | Heavy; inconsistent | Sentence case |
| Sentences full of em dashes, "WORD - fragment" labels, middle-dot strings (A · B · C) | A recognizable rhythm | Plain sentences; separate items with spacing or commas |
| Lorem ipsum, "John Doe", "Acme Inc", "Feature 1", "$99/mo" | Obvious placeholder, and it hides layout problems | Realistic domain data with varied lengths and edge cases |
| Invented metrics, awards, testimonials, customer logos | Dishonest in a real product | Real or none. In a prototype, mark clearly as sample |

## Interaction and states

| Tell | Why | Instead |
|---|---|---|
| Only the happy path: no loading, empty or error state | A mockup, not a product | Build all states first (rule 8) |
| Buttons and links that do nothing; `href="#"` | Dead UI | Wire to a route or handler, or leave the element out |
| Placeholder text used as the label | Disappears while typing; inaccessible | Visible label above the field; placeholder shows an example |
| Validation on every keystroke; all errors in one banner at the top | Hostile; hard to fix | Validate on blur and submit; message under the field; summary only for long forms |
| Submit button disabled with no explanation | Person cannot tell what is wrong | Keep it enabled, show errors on submit |
| Modal for everything; confirm dialogs that say "Are you sure?" | Interrupts needlessly; unclear consequence | Inline editing, drawers for long tasks, named confirms for destructive actions, undo for the rest |
| Row of eight colorful action buttons in every table row | Visual noise | One link in the name column; the rest in an overflow menu |

## Code-level tells

These are visible to anyone who opens the files, and they are the reason a restyle later costs so much.

| Tell | Instead |
|---|---|
| The same grey written five ways; `#fff` and `#ffffff` and `white` | Tokens |
| Inline `style={{ color: '#...' }}`, Tailwind `bg-[#1e293b]`, Flutter `Color(0xFF...)` in widgets | Theme tokens in every case |
| `!important`, `.ant-*` / `::ng-deep` overrides, deep selectors into library internals | Theme configuration; wrapper components with props |
| `div onClick`, `span role="button"` | Native `button` or `a` |
| `z-index: 9999` | Named z-index scale |
| Duplicate CSS selectors, rules that cancel each other | One rule per concern, low specificity |
| A second UI library or icon set added for one component | Use what the project has |
| Custom flex/grid CSS where the library's layout components exist | The library's layout primitives |
| Hardcoded demo credentials or fallback identities in production components | Empty initial values; load from state or the API; show a skeleton |
