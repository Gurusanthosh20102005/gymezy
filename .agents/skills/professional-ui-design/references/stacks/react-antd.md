# React + Ant Design

Applies the ten rules in SKILL.md to a React project that uses Ant Design (AntD). Written for AntD 5 and later; if the installed version differs, check its docs for token names. Follow the project's own file and folder conventions (extension, folder layout, state library); this file covers look and behavior only.

Contents: 1 Use AntD components · 2 One theme · 3 Layout · 4 Patterns · 5 States · 6 Icons · 7 Anti-patterns · 8 AntD checklist

## 1. Use AntD components

Use an AntD component whenever an equivalent exists. Do not add a second UI library for the same job.

| Need | Component |
|---|---|
| Actions | `Button` |
| Inputs | `Input`, `Input.Password`, `Input.TextArea`, `InputNumber`, `Select`, `Checkbox`, `Radio`, `Switch`, `DatePicker`, `TimePicker` |
| Forms and validation | `Form`, `Form.Item` |
| Data | `Table`, `List`, `Descriptions`, `Tag`, `Badge`, `Statistic` |
| Overlays | `Modal`, `Drawer`, `Popconfirm`, `Dropdown`, `Tooltip` |
| Navigation | `Layout` (`Sider`, `Header`, `Content`), `Menu`, `Tabs`, `Breadcrumb`, `Pagination` |
| Containers | `Card`, `Collapse`, `Divider` |
| Feedback and states | `message`, `notification`, `Alert`, `Result`, `Empty`, `Skeleton`, `Spin`, `Progress` |
| People and files | `Avatar`, `Upload` |
| Typography | `Typography` (`Title`, `Text`, `Paragraph`) |

If the project needs a reusable variant (for example a `PageHeader` or a `StatusTag`), wrap AntD components in one shared component with props; do not copy the styling into screens.

## 2. One theme

All visual decisions live in one theme object passed to `ConfigProvider` at the root. Components never override these locally.

```jsx
// theme/appTheme.js: the single owner of color, radius, font and density
export const appTheme = {
  token: {
    colorPrimary: '#1F4E79',          // brand color: defined here and nowhere else
    borderRadius: 6,
    fontSize: 14,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    colorBgLayout: '#F6F7F9',
  },
  components: {
    Button: { controlHeight: 36, fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' },
    Table: { headerBg: '#F1F3F6' },
  },
};
```

```jsx
// index / App root
import { ConfigProvider, App as AntApp, theme } from 'antd';
import { appTheme } from './theme/appTheme';

<ConfigProvider theme={{ ...appTheme, algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
  <AntApp>
    <Routes />
  </AntApp>
</ConfigProvider>
```

- Start values from `assets/tokens.css` (brand, background, text roles) so web and mobile stay aligned, then keep this theme object as the one owner. Do not also maintain a parallel CSS-variable palette for the same decisions.
- Change appearance through `token` and `components` tokens, never by overriding `.ant-*` classes, never with `!important`, never with deep selectors into AntD internals.
- Dark mode and density come from `algorithm` (`theme.darkAlgorithm`, `theme.compactAlgorithm`; combine as an array). Dense admin UIs often use `[theme.defaultAlgorithm, theme.compactAlgorithm]`.
- Need a theme value in code? `const { token } = theme.useToken();` and read `token.colorTextSecondary`, `token.paddingMD`, and so on. A literal hex in JSX is not allowed.
- Static `message.success()`, `Modal.confirm()` and `notification` calls do not see the theme or dark mode. Wrap the app in AntD's `App` component and use `const { message, modal, notification } = AntApp.useApp();` inside components.

## 3. Layout

Use AntD layout components before writing layout CSS.

```jsx
import { Flex, Row, Col, Space, Card, Button, Typography } from 'antd';

// one-dimensional: header, toolbar, button group
<Flex gap="middle" align="center" justify="space-between">
  <Typography.Title level={4} style={{ margin: 0 }}>Users</Typography.Title>
  <Button type="primary">Add user</Button>
</Flex>

// grid: always set gutter and responsive spans
<Row gutter={[16, 16]}>
  <Col xs={24} md={12} xl={8}><Card title="Open orders">...</Card></Col>
  <Col xs={24} md={12} xl={8}><Card title="Revenue">...</Card></Col>
</Row>
```

- App shell with `Layout`, `Sider`, `Header`, `Content`. Page padding from tokens (`token.padding`/`paddingLG`), not fixed pixels.
- `Flex` for one-dimensional alignment, `Row`/`Col` with `gutter={[16, 16]}` for grids, `Space` for small inline groups.
- Use responsive props (`xs`, `sm`, `md`, `lg`, `xl`, `xxl`) on every `Col`; use `Grid.useBreakpoint()` when logic depends on the viewport.
- Avoid fixed pixel widths and hand-written flex/grid CSS when these components can do it.

## 4. Patterns

- **Forms:** `Form` with `layout="vertical"`, `Form.Item` labels above inputs, helper text and errors below, `requiredMark="optional"` when most fields are required. Validation rules come from the project's shared schema or constants, not retyped. One `type="primary"` submit; `loading` while submitting; initial values start empty.
- **Tables:** `rowKey="id"` (the business id), server-side `pagination` for large data, `scroll={{ x: 'max-content' }}` so small screens scroll inside the table, `size="middle"`, `loading` prop, `locale={{ emptyText: <Empty description="No users found" /> }}`. Right-align numeric columns; format dates and currency in one helper. Row actions: one link in the name column plus an overflow `Dropdown`, not a row of colored buttons. Define columns in a factory function outside the component and memoize.
- **Dialogs:** `Modal` for a short task, `Drawer` for longer forms and detail views. Destructive actions use `Popconfirm` or a confirm `Modal` with explicit wording: title "Delete user?", ok button "Delete user" with `okButtonProps={{ danger: true }}`.
- **Buttons:** one `type="primary"` per decision area; `default`, `text` or `link` for the rest; `danger` only for destructive actions. Primary buttons are text-only. Icon-only buttons need a `Tooltip` and `aria-label`.
- **Status:** `Tag` or `Badge` with semantic colors for real status only (Active, Pending, Failed), keeping the label text in the tag.
- **Feedback:** `message.success` for lightweight confirmation, `notification` only for important or long messages, `Alert` for page-level conditions.
- **Typography:** AntD `Typography` with a clear hierarchy (page title, section title, body, caption); no more than three or four sizes on one screen; sentence case.

## 5. States

Every screen implements all of these (rule 8):

- **Loading:** `Skeleton` for page and list content, `Spin` for small areas, `loading` on buttons and tables.
- **Empty:** `Empty` with a short, specific message and, when useful, one action.
- **Error:** `Alert` or `Result` with a plain explanation and a retry.
- **Success:** `message.success`.

## 6. Icons

Use `@ant-design/icons` only, one family (Outlined) across the app, inheriting text color at the standard size. Icons must do something: an action, a status, navigation. No emoji, no sparkle/robot/wand icons, no icon beside every heading or card. Install only if missing: `npm install antd @ant-design/icons`.

## 7. Anti-patterns (fix on sight)

- Hex colors, font sizes or radii inside components.
- Gradient backgrounds, gradient buttons, glow, glassmorphism, colored shadows.
- Emoji or decorative icons in headings, buttons, cards or empty states.
- Several accent colors competing on one screen.
- `.ant-*` overrides, `!important`, `:global` hacks.
- Rebuilding Button, Modal, Select, Table or Form with raw `div` and `input`.
- Cards nested in cards, heavy shadows everywhere.
- ALL CAPS buttons, exclamation-heavy copy, placeholder text.
- Custom flex/grid CSS where `Flex`, `Row`/`Col` or `Space` would work.
- Static `message`/`Modal` calls in a themed or dark-mode app.

## 8. AntD checklist

- [ ] Every standard element is an AntD component.
- [ ] Color, radius, font and density come only from the `ConfigProvider` theme.
- [ ] Layout uses `Flex`, `Row`/`Col` with `gutter`, `Space`, and responsive spans.
- [ ] Forms, tables and dialogs follow the patterns above.
- [ ] Loading, empty and error states exist on every data screen.
- [ ] Toasts and confirms use the `App` context.
- [ ] Icons are Outlined, functional, and consistent.
