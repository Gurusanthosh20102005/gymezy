# Redux Toolkit templates

Contents: 1 Store · 2 Provider · 3 Slice with async thunks · 4 Selectors and dispatch · 5 RTK Query for server data

Match the project's existing file extension and folder names; the examples use `.js` and `src/redux/`.

## 1. Store (`src/redux/store.js`)

Use `configureStore` and combine one reducer per domain.

```javascript
import { configureStore } from "@reduxjs/toolkit";
import sessionReducer from "./slices/sessionSlice";
import userReducer from "./slices/userSlice";

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    user: userReducer,
  },
});

export default store;
```

## 2. Provider (`index.js` or `App.js`)

Wrap the application root once.

```javascript
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import store from "./redux/store";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
```

## 3. Slice with async thunks (`src/redux/slices/<name>Slice.js`)

- **Initial state:** define the shape clearly, with `loading` and `error`.
- **Reducers:** synchronous updates using RTK's Immer-powered mutation syntax.
- **Async thunks:** `createAsyncThunk` for asynchronous work, handling `pending`, `fulfilled` and `rejected` in `extraReducers`. Use thunks for session and auth flows, commands and existing patterns; prefer RTK Query (section 5) for reading server data.

```javascript
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import apiClient from "../../services/apiClient";

export const fetchUserData = createAsyncThunk(
  "user/fetchUserData",
  async (userId, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/api/v1/users/${userId}`);
      if (response?.success) {
        return response.data;
      }
      return rejectWithValue(response?.message || "Failed to fetch user");
    } catch (error) {
      return rejectWithValue(error.message || "Network error");
    }
  }
);

const initialState = {
  profile: null,
  loading: false,
  error: null,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearUserProfile: (state) => {
      state.profile = null;
      state.error = null;
    },
    setLocalProfileUpdate: (state, action) => {
      state.profile = { ...state.profile, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserData.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(fetchUserData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearUserProfile, setLocalProfileUpdate } = userSlice.actions;
export default userSlice.reducer;
```

## 4. Selectors and dispatch in components

- **Granular selectors:** select only the properties the component needs, so it re-renders only when they change.

  ```javascript
  // Preferred
  const profile = useSelector((state) => state.user.profile);
  const isLoading = useSelector((state) => state.user.loading);

  // Avoid: subscribes to the entire root state
  const state = useSelector((state) => state);
  ```

- **Derived data** belongs in a selector (use `createSelector` for expensive derivations), not in a stored copy.
- **Dispatch** inside effects or handlers with a complete dependency array:

  ```javascript
  const dispatch = useDispatch();

  useEffect(() => {
    if (userId) {
      dispatch(fetchUserData(userId));
    }
  }, [dispatch, userId]);
  ```

## 5. RTK Query for server data

RTK Query is part of Redux Toolkit. It fetches, caches, deduplicates and invalidates server data, so components never copy API data into slices or `useState`.

```javascript
// src/redux/api/usersApi.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/v1", credentials: "include" }),
  tagTypes: ["User"],
  endpoints: (build) => ({
    getUser: build.query({
      query: (id) => `users/${id}`,
      providesTags: (result, error, id) => [{ type: "User", id }],
    }),
    updateUser: build.mutation({
      query: ({ id, ...patch }) => ({ url: `users/${id}`, method: "PATCH", body: patch }),
      invalidatesTags: (result, error, { id }) => [{ type: "User", id }],
    }),
  }),
});

export const { useGetUserQuery, useUpdateUserMutation } = usersApi;
```

Register it in the store:

```javascript
export const store = configureStore({
  reducer: {
    session: sessionReducer,
    [usersApi.reducerPath]: usersApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(usersApi.middleware),
});
```

In a component, `const { data, isLoading, error } = useGetUserQuery(userId);` gives you the loading, error and data states to render.
