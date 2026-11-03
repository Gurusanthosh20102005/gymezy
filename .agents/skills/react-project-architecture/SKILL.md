---
name: react-project-architecture
description: 'React application architecture: domain-oriented folder structure and naming, page and component layering, Redux Toolkit and server-state conventions, custom hooks and effect hygiene, and the API client layer. Use whenever creating or moving React files, scaffolding a React project or feature, adding a component, page, hook, slice or service, setting up state management, writing useEffect, useCallback or useMemo logic, or refactoring React structure, even if the user only says "add a page" or "fetch this data in the component".'
---

# React Project Architecture

How a React application is organized: where files live, how pages, components, hooks, state and API access fit together, and how to keep that consistent as the app grows. This skill also owns the **folder structure and naming rules**, so the tree is defined in exactly one place.

**Discover first.** Read `package.json` and the `src/` tree before creating anything, and match the project's existing conventions exactly: file extension, folder layout, state library, UI library, naming. The defaults below apply to new projects and to gaps the existing code leaves. Never rename or reorganize existing files just to match this skill, and never create files outside the established structure unless asked.

## 1. Structure and naming (defaults for a new project)

The application flow is `index` (mounts the app and providers) to `App` (routing, layouts, the global auth check) to **pages** to **components**.

Group by **domain** (the part of the product a file serves), not by file type. Share only what is genuinely shared. Rename the domain folders to fit the product:

```text
src/
├── <domain>/                      # one folder per domain or role area, e.g. admin/, billing/, user/
│   ├── <DomainView>.js            # pages and screens for that domain
│   └── components/                # components used only inside this domain
├── general/                       # shared screens (login, not found) and shared components
│   └── components/
├── hooks/                         # use<Feature>.js
├── redux/                         # store setup and slices (or store/, per the project)
│   ├── slices/
│   │   └── <domain>Slice.js
│   └── store.js
├── services/                      # apiClient.js and other external-service wrappers
├── utils/                         # pure helpers and formatters
├── App.js
├── index.js
└── styles (global CSS and the token source)
```

| Kind of file | Naming |
|---|---|
| Components and pages | PascalCase (`UserTable.js`, `AdminDashboard.js`) |
| Hooks | camelCase starting with `use` (`useAuthSession.js`) |
| Redux slices | camelCase ending in `Slice` (`sessionSlice.js`) |
| Utilities and services | camelCase (`apiClient.js`, `formatters.js`) |

**File extension:** use whatever the project uses. If React files are `.js`, keep them `.js` and do not create `.jsx` files (and the reverse for `.jsx` or `.tsx`). For a brand-new project, `.jsx` or `.tsx` is the modern default because tools like Vite expect it.

## 2. Decide where state lives

| State | Home |
|---|---|
| Used by one component (input text, open or closed) | local `useState` or `useReducer` |
| Shared by a few nearby components | lift it to the nearest common parent, or a small Context |
| Used across screens (session, theme, cart, shared filters) | a store slice (Redux Toolkit) |
| **Data from the server** (lists, entities) | a server-state cache: **RTK Query** (when using Redux Toolkit) or React Query. Do not hand-copy it into slices or `useState` |
| Derived from other state | compute it with a selector or `useMemo`; do not store it |
| Reflected in the URL (page, tab, filters) | the router and query string |

If the project already fetches with `createAsyncThunk` and stores server data in slices, follow that pattern for consistency, and suggest RTK Query when adding substantial new data fetching (this keeps server data in a single cache, as `single-source-of-truth` requires).

## 3. Components and pages

- **Pages orchestrate:** connect the store, call hooks, and pass explicit props. **Components are reusable:** they receive props and callbacks and hold no knowledge of where data comes from.
- Never define a component inside another component (it remounts on every render); define it at module scope or in its own file.
- Keep components small. When a component accumulates logic, move that logic into a custom hook or a pure helper (see `clean-code-sonarqube-guard` for complexity limits).
- Avoid prop-drilling beyond two or three levels: use context or the store.
- **Every component that shows remote data handles loading, empty and error states.**
- Use the project's UI library and design tokens for everything visible, with no literal colors or sizes: see `professional-ui-design`.

## 4. Hooks

Examples and templates: `references/hooks.md`.

- Extract reusable logic, subscriptions, keyboard listeners and data orchestration into custom hooks in `src/hooks/`, prefixed `use`, returning predictable objects or tuples.
- **Dependency arrays are complete.** Never omit a dependency used in the effect, and never disable the lint rule to silence it.
- **Clean up** timers, listeners, subscriptions and in-flight requests by returning a cleanup function. React StrictMode runs effects twice in development, so effects must tolerate being set up and torn down.
- Do not use an effect to derive state or to react to a user event: compute during render, or handle it in the event handler.
- Use `useCallback` and `useMemo` when they matter (memoized children, hook dependencies, heavy lists, expensive computation), not by default.
- Use `useRef` for DOM nodes, timer IDs and previous values that must not trigger a re-render.

## 5. State management with Redux Toolkit

Templates (store, Provider, slice with async thunks, selectors): `references/redux-toolkit.md`.

- Use `configureStore` from `@reduxjs/toolkit`, one slice per domain, state shaped with `loading` and `error` where async work happens.
- Reducers use RTK's Immer-powered mutation syntax. Async work uses `createAsyncThunk` (or RTK Query) and handles `pending`, `fulfilled` and `rejected`.
- **Granular selectors:** select only what the component needs, never the whole root state.
- Slices hold client and session state. Keep server data in the cache (section 2) and derived data out of the store.

## 6. API access layer

- Exactly one `apiClient` module. Components never call `fetch` or Axios directly; pages, hooks or the cache library do, through the client.
- The base URL and other environment values come from the project's single validated config module, not from `process.env` or `import.meta.env` scattered across files (see `single-source-of-truth`). Paths come from the shared route constants.
- Normalize errors in one interceptor so the UI receives a consistent shape, and cancel in-flight requests when a component unmounts (`AbortController`) or let the cache library do it.
- **Token storage and the `Authorization` header follow `jwt-auth-lifecycle`.** Never store tokens in `localStorage` or `sessionStorage`, and do not copy token code into this layer.

```javascript
// services/apiClient.js
import axios from "axios";
import { config } from "../config";

const apiClient = axios.create({
  baseURL: config.apiUrl,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // cookie-based sessions; see jwt-auth-lifecycle for the token pattern
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject({
    status: error.response?.status ?? 0,
    code: error.response?.data?.error?.code ?? "NETWORK_ERROR",
    message: error.response?.data?.message ?? "Could not reach the server.",
  }),
);

export default apiClient;
```

## 7. No hardcoded identities or credentials

Never write fallback emails, usernames, tenant IDs or mock credentials into components, headers, store slices or form `initialValues`. Render from store or server data, and show a skeleton or empty state while it loads. The rule and examples are owned by `clean-code-sonarqube-guard` (section 11).

## 8. Checklist

- [ ] The new files match the existing structure, naming and extension.
- [ ] State lives in the right home; server data is not copied into slices or local state.
- [ ] Pages orchestrate and components are reusable; no component defined inside another.
- [ ] Effects have complete dependencies and cleanups; no effect used to derive state.
- [ ] All HTTP goes through the single API client; config values come from the config module.
- [ ] Loading, empty and error states exist for remote data.
- [ ] No literal colors or sizes, and no hardcoded identities.

## Works together with

`professional-ui-design` (everything visible), `single-source-of-truth` (config, constants, routes, one place for server state), `clean-code-sonarqube-guard` (complexity, nesting, accessibility semantics), `jwt-auth-lifecycle` (tokens and sessions), `api-standardization` (the contract the client consumes).
