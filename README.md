# Draft It — Redux Toolkit post manager

A responsive post drafting workspace that demonstrates centralized state management with Redux Toolkit and React-Redux. Posts and publishing platforms live in normalized entity stores, while component-only UI details such as the active filter and mobile panel remain local state.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Redux architecture

```text
Provider
└── store
    ├── posts      { ids: [], entities: {}, status, activeRequestId, error }
    └── platforms  { ids: [], entities: {} }
```

- `createEntityAdapter` normalizes both post and platform collections.
- `postsSlice` provides create, update, delete, hydrate, and save flows.
- `platformsSlice` provides platform CRUD reducers and selectors.
- Typed `useAppDispatch` and `useAppSelector` hooks keep component access type-safe.
- Posts reference platforms by `platformIds`, avoiding duplicated platform objects.
- Async thunks simulate API latency and persist drafts to `localStorage`.
- Loading, saving, saved, deleting, and failure states are represented in Redux.

## Performance strategy

- `createSelector` derives filtered drafts, category totals, and reading metrics without duplicating them in state.
- Selector factories give each mounted workspace its own memoization cache.
- `useDeferredValue` keeps search input responsive while a large draft list is filtered.
- `React.memo` isolates draft cards and the editor so unrelated UI state does not render them again.
- `useCallback` keeps the handlers passed to memoized children referentially stable.
- The sidebar's “Selector runs” value makes recomputation visible while experimenting.

## Key files

- `lib/store.ts` — store configuration and inferred Redux types
- `lib/hooks.ts` — typed React-Redux hooks
- `lib/features/posts/postsSlice.ts` — normalized post state, CRUD reducers, and async thunks
- `lib/features/posts/selectors.ts` — memoized derived-state selectors
- `lib/features/platforms/platformsSlice.ts` — normalized platform state and CRUD reducers
- `app/providers.tsx` — client-side Redux Provider
- `app/page.tsx` — connected post-management interface

## Verification

```bash
npx tsc --noEmit
npm run lint
npm run build
```
