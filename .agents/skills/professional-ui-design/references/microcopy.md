# Microcopy and sample data

Words in a UI exist to help someone understand and act. Treat them with the same restraint as spacing and color. Copy that reads as generated makes the whole design feel templated, however clean the layout.

Contents: 1 Principles · 2 Patterns · 3 Formatting data · 4 Sample data · 5 Localization

## 1. Principles

1. **Use the person's words, not the system's.** "Notifications", not "Webhook configuration". "Sign in", not "Authenticate".
2. **Name actions with a verb and an object**, and keep the name through the whole flow: the button "Publish" produces the toast "Published", not "Success!".
3. **Be specific and short.** Cut filler: "Please", "Simply", "Just", "Successfully". Each element does one job.
4. **Sentence case** for labels, buttons, headings and menus. Proper nouns keep their capitals. No trailing period on buttons or short labels; full sentences get one.
5. **Active voice.** Present tense for state ("Payment failed"), past tense for confirmations ("Invoice sent").
6. **Errors say what happened and what to do.** Do not blame the person, do not apologize, do not say "Oops". Do not show raw error codes as the message; put a reference ID in secondary text if support needs one.
7. **Empty states invite an action** instead of announcing nothing.
8. **Placeholders are examples, never labels.** Hints go under the field.
9. **Tone**: calm and neutral by default; match the brand and audience, never louder than the situation. No exclamation marks, no emoji in product UI.

## 2. Patterns

| Element | Write | Avoid |
|---|---|---|
| Primary button | Save changes, Invite member, Publish post, Create project | Submit, OK, Click here, Get started on every page |
| Cancel | Cancel | No thanks! |
| Destructive confirm | Title: Delete 3 invoices? Body: They will be removed for everyone and cannot be recovered. Buttons: Delete invoices, Cancel | Are you sure? Yes / No |
| Success | Changes saved. Invoice sent to dana@example.com | Successfully saved! |
| Load error | Couldn't load invoices. Check your connection and try again. | Oops! Something went wrong. |
| Validation | Enter an email address like name@company.com | Invalid input |
| Required field | Enter your first name | This field is required |
| Credentials error | Incorrect email or password. | The password you entered is wrong for this email. |
| Empty, first use | No projects yet. Create a project to start tracking work. | Nothing here! |
| Empty, search | No results for "alpha". Try another search or clear filters. | No data |
| Loading (only if over about a second) | Loading invoices... | Please wait while we process your request... |
| Permission | You don't have access to billing. Ask an admin to grant access. | Access denied |
| Tooltip | Download as CSV | Click this button to download the data as a CSV file |
| Link | View invoice | Click here, Learn more (when more is not specific) |
| Heading | Team members | Manage and Supercharge Your Team Members Effortlessly |

## 3. Formatting data

- Format with the platform's locale tools (`Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`), never by string concatenation.
- Consistent decimals, thousands separators and currency symbols within a column or list. Units next to the number or in the header.
- Dates: relative for recent events ("3 hours ago") with the exact time on hover; absolute for anything older or legally relevant.
- Truncate long strings with an ellipsis and expose the full text; never truncate inside a number.
- Pluralize correctly ("1 invoice", "2 invoices") through the localization library's plural rules.

## 4. Sample data

Prototypes and empty-database screens need data, and the quality of it decides whether the design looks real.

- Make it **realistic and domain-specific**: names from different backgrounds, plausible amounts, dates relative to today, believable statuses in realistic proportions.
- **Vary it** so the layout is tested: some very long names, a missing optional field, a zero, a large number, a tag that wraps.
- No "John Doe", "Jane Doe", "Acme Inc", "Feature 1", `user@example.com`, lorem ipsum. For sample emails use the reserved `example.com` domain with a varied local part.
- **Never invent proof**: customer logos, testimonials, award badges, user counts or uptime figures. Omit them, or label them as sample content in a prototype.
- Keep sample data in a fixtures or mocks module. It is never a fallback in production code: `user?.name || 'Admin'` shows one person's identity to another and hides a loading bug. Render a skeleton or an empty state instead. Form `initialValues` start empty, with helpful placeholders.

## 5. Localization

- Every user-visible string lives in the project's message catalog or i18n files when it has one, defined once (this is the single-source-of-truth rule applied to words). No string built from fragments.
- Leave room: translations commonly run 30 to 40% longer. Avoid text in images and fixed-width buttons.
- Use the plural and gender features of the i18n library rather than conditionals.
- Right-to-left support comes from logical CSS properties (`margin-inline-start`) and from not hardcoding left and right.
