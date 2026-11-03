# Hooks templates and patterns

Contents: 1 Custom hooks · 2 Effect hygiene and cleanup · 3 Fetching in an effect · 4 useCallback and useMemo · 5 useRef · 6 Avoid

## 1. Custom hooks (`src/hooks/`)

Extract reusable logic, subscriptions, keyboard listeners, event handlers and data orchestration into custom hooks.

- Prefix with `use` (`useAuthSession`, `useKeyboardShortcuts`).
- Return clean, predictable data structures (an object, or a tuple for small hooks).

```javascript
// src/hooks/useAuthSession.js
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { checkSession } from "../redux/slices/sessionSlice";

export const useAuthSession = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, user, loading } = useSelector((state) => state.session);

  useEffect(() => {
    dispatch(checkSession());
  }, [dispatch]);

  return { isAuthenticated, user, loading };
};
```

## 2. Effect hygiene and cleanup

- **Complete dependency array.** Never omit a dependency the effect uses.
- **Always clean up** subscriptions, timers, listeners and abort controllers by returning a cleanup function.

```javascript
useEffect(() => {
  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      onClose();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [onClose]);
```

## 3. Fetching in an effect (when not using a cache library)

Cancel the request on cleanup and ignore results after unmount. Prefer RTK Query or React Query where available.

```javascript
useEffect(() => {
  const controller = new AbortController();

  apiClient
    .get(`/api/v1/orders/${orderId}`, { signal: controller.signal })
    .then(setOrder)
    .catch((error) => {
      if (error.code !== "ERR_CANCELED") setError(error);
    });

  return () => controller.abort();
}, [orderId]);
```

## 4. useCallback and useMemo

Use them when they matter: handlers passed to memoized children or tables, values used in another hook's dependency array, and genuinely expensive derived data. Do not wrap everything by default.

```javascript
// Event handler passed to a memoized child
const handleDeleteUser = useCallback((userId) => {
  dispatch(deleteUser(userId));
}, [dispatch]);

// Derived data that is expensive to recompute
const activeUsers = useMemo(() => users.filter((u) => u.status === "ACTIVE"), [users]);
```

## 5. useRef for mutable values without re-renders

Use `useRef` for DOM nodes, timer IDs and previous values that must not trigger a render.

```javascript
const timerRef = useRef(null);

const startTimer = useCallback(() => {
  if (timerRef.current) clearInterval(timerRef.current);
  timerRef.current = setInterval(() => {
    // timer work
  }, 1000);
}, []);

useEffect(() => {
  return () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };
}, []);
```

## 6. Avoid

- An effect that only derives state from props or state (compute it during render, or with `useMemo`).
- An effect that responds to a user action (do it in the event handler).
- Disabling `react-hooks/exhaustive-deps` to stop a loop; fix the dependency instead.
- Defining a component or a hook conditionally or inside another component.
- Reading from `localStorage` or `sessionStorage` for auth tokens (see `jwt-auth-lifecycle`).
