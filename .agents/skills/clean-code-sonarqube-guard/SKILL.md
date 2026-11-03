---
name: clean-code-sonarqube-guard
description: 'Clean-code and SonarQube quality rules for JavaScript, TypeScript, React and Node.js: cognitive complexity of 15 or less, no nested ternaries, shallow function nesting, accessible semantic HTML in JSX, secure randomness, safe regular expressions, no hardcoded secrets or fallback identities, and test and coverage hygiene. Use whenever writing, refactoring or reviewing JS/TS code or fixing lint or SonarQube issues, including React components, hooks, forms, tables, modals, file uploads, ID or token generation, regex or number parsing, and unit tests, even if the user never mentions Sonar or clean code.'
---

# Clean Code and SonarQube Quality Guard

## Objective

Write code that passes SonarQube quality gates and reads like it was written by a careful senior engineer: low cognitive complexity, accessible semantics, secure cryptography, safe regular expressions, and no hardcoded environment, credential or tenant assumptions.

The rules are written for JavaScript, TypeScript, React and Node.js (they name Sonar's JS rules). The principles (small functions, early returns, no magic values, no secrets in source, safe randomness) apply in every language; use the equivalent rule in that language's analyzer.

**Discover first.** Read the project's ESLint, Prettier and SonarQube configuration (`sonar-project.properties`, quality profile, `.eslintrc`) and follow it. Never silence a rule, add a suppression comment or loosen a threshold just to get a green build; fix the cause. If a suppression is truly justified, keep it as narrow as possible with a comment saying why.

---

## 1. Cognitive Complexity Limit (SonarQube S3776, limit 15)

Every function, React component, hook (`useEffect`, `useCallback`, `useMemo`), controller, and helper MUST maintain a Cognitive Complexity score of **15 or lower** (aim for 5 or less).

### Core Strategies for Low Complexity:

1. **Use Lookup / Strategy Dictionaries Instead of Nested `if / else` Ladders**:
   - Avoid cascading `if (type === "A") { if (...) { ... } } else if (type === "B") { ... }`.
   - Use strategy lookup maps with isolated pure handler functions:
     ```javascript
     const STATUS_CONFIG_HANDLERS = {
       active: (filters) => ({ status: "ACTIVE", ...filters }),
       pending: (filters) => ({ status: "PENDING", ...filters }),
       archived: (filters) => ({ status: "ARCHIVED", ...filters }),
     };

     export const resolveFilterParams = (type, filters) => {
       const handler = STATUS_CONFIG_HANDLERS[type];
       return handler ? handler(filters) : {};
     };
     ```

2. **Extract Data Transformers & Mappers to Module Scope**:
   - Never write multi-step `.map()` / `.filter()` / `.reduce()` transformation chains inside component render bodies or lifecycle hooks.
   - Extract pure mapper functions outside the component (e.g. `mapEntityToRow`, `filterRecordsByKeyword`, `aggregateMetrics`).

3. **Decompose Large Views & Modals into Focused Subcomponents**:
   - Split complex components into modular sections (e.g. `<HeaderSection />`, `<DetailsSection />`, `<AuditHistorySection />`).
   - Move nested dialogs, drawers, and child forms into independent components.
   - Keep the parent component thin and focused strictly on state orchestration.

4. **Extract Calculation, Parsing & Business Logic into Pure Helpers**:
   - Separate mathematical computations, currency calculations, date manipulations, and tax/metric logic into dedicated pure functions outside the component or in utility modules.

5. **Extract Form Validators & Record Initializers**:
   - Validation routines, field matchers, and form initializers (`initFormData`, `validatePayload`) must be defined outside the component body.

6. **Flatten Async Chains & Fetch Handlers**:
   - Isolate promise chains (`.then()` / `.catch()`) or async data parsing into dedicated helper functions rather than inlining multi-branch parsing logic inside component lifecycles.

7. **Table Column Factories & Custom Cell Renderers**:
   - Define table column configurations in factory functions outside the component:
     ```javascript
     function buildEntityColumns({ onEdit, onDelete, onViewDetails }) {
       return [
         { title: "Name", key: "name", render: (_, record) => <EntityCell record={record} onClick={onViewDetails} /> },
         { title: "Actions", key: "actions", render: (_, record) => <ActionMenu onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} /> },
       ];
     }
     ```
   - Inside the component, memoize the columns array:
     ```javascript
     const columns = useMemo(() => buildEntityColumns({ onEdit, onDelete, onViewDetails }), [onEdit, onDelete, onViewDetails]);
     ```

8. **Multi-Tab / Multi-View Routing Subcomponents**:
   - Replace long nested ternaries (`activeTab === 'a' ? ... : activeTab === 'b' ? ... : ...`) with a dedicated tab router subcomponent using early returns or a component registry map.

---

## 2. Nested Ternary Operators (SonarQube S3358)

Never nest ternary operators (`condition1 ? (condition2 ? valA : valB) : valC`).

### Anti-Pattern:
```javascript
// AVOID: S3358 Nested Ternary
const statusColor = isSuccess ? "green" : isWarning ? "yellow" : isError ? "red" : "gray";
```

### Best Practice:
```javascript
// PREFERRED: Dedicated helper function with early returns or lookup map
function resolveStatusColor({ isSuccess, isWarning, isError }) {
  if (isSuccess) return "green";
  if (isWarning) return "yellow";
  if (isError) return "red";
  return "gray";
}
```

---

## 3. React Component Hierarchy & Scoping (SonarQube: components must not be defined inside other components)

**Never define a React functional component inside the body of another React component.** Nested component declarations re-mount on every render cycle, destroying internal state, degrading performance, and failing the SonarQube rule against nested component definitions.

### Anti-Pattern:
```javascript
function ParentComponent({ items }) {
  // AVOID: Defining subcomponent inside parent body
  const ItemRow = ({ item }) => <div>{item.name}</div>;

  return <div>{items.map((item) => <ItemRow key={item.id} item={item} />)}</div>;
}
```

### Best Practice:
```javascript
// PREFERRED: Defined at module scope or in a separate file
function ItemRow({ item }) {
  return <div>{item.name}</div>;
}

function ParentComponent({ items }) {
  return <div>{items.map((item) => <ItemRow key={item.id} item={item} />)}</div>;
}
```

---

## 4. Accessibility & Semantic HTML (SonarQube S6848 non-interactive handlers, S6819 prefer native tags, S6853 label association)

1. **Native `<button>` Over `role="button"` or Clickable `<div>`**:
   - Never attach `onClick`, `role="button"`, `role="dialog"`, or `tabIndex` to non-interactive elements like `<div>`, `<span>`, or `<a>` without `href`.
   - Always use a native `<button>` element with an explicit `type` attribute (`type="button"`, `type="submit"`, `type="reset"`).
   - For custom clickable cards or list items, style a native `<button type="button">` with CSS resets:
     ```css
     .clickable-item-btn {
       display: block;
       width: 100%;
       background: transparent;
       border: var(--border-width) solid var(--color-border);
       border-radius: var(--radius-md);
       padding: var(--space-3) var(--space-4);
       font: inherit;
       color: inherit;
       text-align: left;
       cursor: pointer;
     }
     ```
     (Token names follow the project's own token source; see `professional-ui-design`. The point: no literal colors or sizes.)

2. **Dialogs & Modals (`<dialog>` over `role="dialog"`)**:
   - Use standard modal container libraries or native `<dialog>` elements instead of assigning `role="dialog"` to generic `<div>` tags.

3. **Rich-Text & `contentEditable` Containers**:
   - Do not assign JSX keyboard/mouse listeners (`onKeyUp`, `onMouseUp`) or `tabIndex` directly to `<div contentEditable={true}>`.
   - Let native focus manage selection, and attach selection change listeners via `useEffect` event listeners on the container ref.

4. **Semantic File Uploads**:
   - Instead of attaching click/drag events to non-interactive `<div>`s, wrap or associate a hidden `<input type="file" id="file-upload" />` with `<label htmlFor="file-upload">`.

5. **Form Label Association (SonarQube S6853)**:
   - Every `<label>` element MUST have an `htmlFor="inputId"` matching an `<input id="inputId">`, `<select>`, or `<textarea>`.
   - **Never use `<label>` for static text**: Use `<div>`, `<span>`, `<p>`, or typography components for card headers, metric titles, or badges.

---

## 5. JavaScript / ES6+ & TypeScript Standards

1. **Set Lookups over Array.includes for Static Membership**:
   - For collections used for lookup checks, define `const ALLOWED_KEYS = new Set(["a", "b", "c"]);` and use `ALLOWED_KEYS.has(key)`.

2. **Trailing Default Parameters** (SonarQube: default parameters should be last):
   - Never place default values on non-trailing function parameters. When several optional values exist, prefer one options object:
     ```javascript
     // FORBIDDEN:
     export const fetchReport = (id, format = "json", dateFrom, dateTo) => { ... };

     // CORRECT: required values first, optional values in an options object with defaults
     export const fetchReport = (id, { format = "json", dateFrom, dateTo } = {}) => { ... };
     ```

3. **Number Parsing & NaN Verification** (prefer the `Number.*` static methods):
   - Always use `Number.parseInt(value, radix)` instead of global `parseInt`.
   - Always use `Number.parseFloat(value)` instead of global `parseFloat`.
   - Always use `Number.isNaN(value)` instead of global `isNaN`.

4. **DOM Node Removal**:
   - Use `node.remove()` instead of legacy `node.parentNode.removeChild(node)`.

5. **Variable Assignments in Expressions (SonarQube S1121)**:
   - Never assign variables inside conditional tests or binary expressions (e.g. `if ((val = compute()))`). Assign the variable in a separate statement before the condition.

6. **String & Array Modernization**:
   - Prefer `str.replaceAll("target", "replacement")` over `str.replace(/target/g, "replacement")`.
   - Prefer `String.fromCodePoint(...)` and `str.codePointAt(i)` over `fromCharCode`/`charCodeAt`.
   - Prefer `structuredClone(obj)` over `JSON.parse(JSON.stringify(obj))` for deep copies.
   - Prefer `Date.now()` over `new Date().getTime()` for timestamps.

---

## 6. Regex & Catastrophic Backtracking Prevention (Rule: `javascript:S5852`)

- Avoid nested quantifiers (e.g. `(a+)+`) and unbounded lookarounds that can trigger exponential ReDoS (Regular Expression Denial of Service).
- **HTML Stripping**:
  - AVOID: `/<[^>]*>/g` or `/<[^>\r\n]+>/g` on large inputs.
  - PREFERRED: Safe string chunking or standard DOM/HTML parser:
    ```javascript
    export function sanitizeHtmlText(str) {
      if (!str || !str.includes("<")) return str || "";
      return str
        .split("<")
        .map((chunk, i) => (i === 0 ? chunk : chunk.substring(chunk.indexOf(">") + 1)))
        .join("");
    }
    ```

---

## 7. Function Nesting Depth (SonarQube S2004, at most 4 levels)

Do not nest functions more than 4 levels deep.

### Anti-Pattern:
```javascript
// AVOID: Component -> useEffect -> async function -> forEach -> forEach -> find (6 levels)
function DataView() {
  useEffect(() => {
    async function loadData() {
      groups.forEach((group) => {
        group.items.forEach((item) => {
          options.find((opt) => opt.id === item.id);
        });
      });
    }
  }, []);
}
```

### Best Practice:
```javascript
// PREFERRED: Extract item processor outside component
const matchItemOption = (item, options) => options.find((opt) => opt.id === item.id);

const processGroupItems = (groups, options) => {
  groups.forEach((group) => {
    (group.items || []).forEach((item) => matchItemOption(item, options));
  });
};

function DataView() {
  useEffect(() => {
    processGroupItems(groups, options);
  }, [groups, options]);
}
```

---

## 8. Cryptography, Randomness & Identifier Safety (SonarQube S2245)

Never use `Math.random()` for codes, tokens, session identifiers, unique keys or any security-sensitive number.

### Guidelines
- **Security-sensitive values are generated on the server.** One-time codes, verification codes, reset tokens, API keys and session IDs are never created in the browser, because anything generated client-side can be chosen by the client.
- **Node.js:**
  ```javascript
  import { randomBytes, randomInt, randomUUID } from "node:crypto";
  const otp = String(randomInt(0, 1_000_000)).padStart(6, "0"); // uniform, no modulo bias
  const token = randomBytes(32).toString("hex");                 // 256-bit token
  const id = randomUUID();
  ```
- **Browser, for non-secret identifiers only** (element IDs, optimistic client keys): `crypto.randomUUID()`. Where it is unavailable, fall back to `crypto.getRandomValues`, not to `Date.now()` or `Math.random()`, which are predictable and collide.
  ```javascript
  const clientId = globalThis.crypto.randomUUID();
  ```
- **List and table row keys (SonarQube S6479):** use a stable business `id` or code (`key={item.id}`). Use the array index only for static lists that are never reordered, filtered or inserted into, because index keys cause wrong state and wasted re-renders.
- Never expose or depend on internal database keys (such as MongoDB `_id`) in frontend components, tables or API payloads (see `mongodb-architecture`).

---

## 9. Invariant Function Returns (Rule: `javascript:S3516`)

A function should never return the exact same value across all branches without variance.

### Anti-Pattern:
```javascript
// S3516: All branches invariant
const handleFile = (file) => {
  if (!file) return false;
  process(file);
  return false;
};
<Upload beforeUpload={handleFile} />
```

### Best Practice:
Make action/file-processing functions `void` (no return value), and explicitly return the expected boolean inside event wrappers:
```javascript
const handleFile = (file) => {
  if (!file) return;
  process(file);
};
<Upload beforeUpload={(file) => { handleFile(file); return false; }} />
```

---

## 10. Secrets, Tokens & Subresource Integrity (SonarQube: hard-coded secrets, S5725)

1. **No Hardcoded Tokens or Credentials in Source Files**:
   - Never commit API keys, SonarQube tokens, JWT secrets, or DB passwords in properties files, configuration scripts, or source code.
   - Inject secrets via environment variables (`process.env.SECRET_KEY`) or CLI parameters (`-Dsonar.token=$SONAR_TOKEN`).
2. **Subresource Integrity (SRI)**:
   - When loading third-party scripts or CSS from CDNs, always specify `integrity="sha384-..."` and `crossOrigin="anonymous"`.

---

## 11. Zero Hardcoded Environment, Credentials & Tenant Assumptions

This section is the single owner of the "no fallback identities" rule; other skills point here.

Never hardcode fallback demo codes, sample credentials, fake emails, placeholder identities or static tenant configuration in production source files:
- **Forbidden:** `const email = user?.email || 'admin@example.com';`
- **Forbidden:** `const tenantId = activeTenant || "DEMO-TENANT-123";`
- **Forbidden:** mock credentials in form `initialValues` (for example `initialValues={{ email: 'admin@example.com', password: '...' }}`). Initial values start empty, with helpful placeholders.
- **Forbidden:** hardcoded organization names, sample user objects or static terms in headers, sidebars or core logic.
- **Required:** read configuration and the user profile from application state, the session context or the backend. While data is absent, fall back to a neutral empty value (`""`, `[]`, `null`) or render a loading or empty state. Demo data belongs in test fixtures and story files only.

---

## 12. CSS Quality & Contrast

1. **No Duplicate Selectors** (SonarQube CSS rules):
   - Never duplicate identical CSS class, ID, or element selectors within the same stylesheet.
2. **Accessible Text Contrast (WCAG AA: 4.5:1 for normal text, 3:1 for large text)**:
   - Avoid low-contrast text (for example light gray `#94a3b8` on white `#ffffff` is only 2.56:1).
   - Use accessible pairings for text, badges and interactive controls. Color tokens, contrast checking and the full accessibility baseline live in `professional-ui-design`; follow it.
3. **Responsive Sizing & Word Wrapping**:
   - Replace deprecated `word-break: break-word` with standard `overflow-wrap: break-word`.
   - Never use `!important` on `letter-spacing` or `line-height` to allow user accessibility zoom adjustments.

---

## 13. React Hooks & Callback Hygiene

- Memoize handlers with `useCallback` when they matter: passed to memoized children, used in another hook's dependency array, or given to a table or list that re-renders heavily. Otherwise skip it; blanket memoization adds noise and cost.
- Satisfy `react-hooks/exhaustive-deps` without disabling the rule. If an effect loops, fix the dependency (stabilize the value, or use `useRef` for a mutable value) instead of suppressing the warning.
- Remove unused imports, variables and arguments immediately.
- Use optional chaining (`obj?.prop`, `fn?.()`) instead of verbose manual guards.

---

## 14. Deprecated Browser APIs (SonarQube S1874)

- Do not use deprecated DOM APIs such as `document.execCommand`.
- For rich-text editing, use a maintained editor library (Lexical, TipTap, ProseMirror, Slate) or the Selection and Range APIs, rather than `execCommand`.
- If a deprecated API is genuinely unavoidable (a legacy browser requirement), isolate it in one small wrapper module, call it plainly, and add a narrow, commented suppression explaining why and what replaces it. **Do not obfuscate the call** (for example by building the method name from string pieces) to hide it from the analyzer: that defeats the purpose of the check and makes the code harder to read and to remove later.

---

## 15. Automated Testing & Coverage Pipeline Standards

1. **Unit Test Structure**:
   - Write deterministic unit tests with Jest / Vitest and React Testing Library for utilities, services, state slices, and UI components. For backend layers, mocking boundaries and test structure, follow `backend-unit-testing`.
2. **Test Environment Hygiene**:
   - Set up browser API mocks (`window.matchMedia`, `ResizeObserver`, `HTMLCanvasElement`) in `setupTests.js` / test bootstrap files.
3. **Coverage Pipeline Integration**:
   - Export coverage reports in LCOV format (`coverage/lcov.info`).
   - Configure scanner property: `sonar.javascript.lcov.reportPaths=coverage/lcov.info`.
   - Maintain at least 80% test coverage on new code or align Quality Gate profiles accordingly.

---

## Works together with

`professional-ui-design` (accessibility, contrast and tokens in markup and CSS), `react-project-architecture` (component, hook and store structure), `backend-unit-testing` (backend tests), `single-source-of-truth` (no magic strings or numbers), `jwt-auth-lifecycle` and `password-security` (secure tokens and credentials), `git-workflow` (never commit secrets).
