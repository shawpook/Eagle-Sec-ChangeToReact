# Retired legacy files (2026-09-16)

This directory preserves the contents of the four files retired by M7-1 before
their removal from the publishable source tree. The archive is documentation-only
and is not part of the application build or delivery closure.

| Archived path | Retired source path | Replacement / rationale |
|---|---|---|
| `src/app/js/services/url-state-service.js` | `src/app/js/services/url-state-service.js` | `src/app/react/core/bundleGlobals.ts` installs the active `window.UrlStateService` implementation. |
| `src/build/config.gypi` | `src/build/config.gypi` | Generated node-gyp configuration; the current build uses Vite and has no consumer. |
| `src/test/api-v2/test-snippets.js` | `src/test/api-v2/test-snippets.js` | Manual DevTools console script; API coverage now lives in `tests/**` and the real server routes. Kept here for its endpoint inventory. |
| `src/app/main.js` | `src/app/main.js` | Empty legacy Webpack shell; the active entry is `src/app/react/main.tsx`. |

Rollback is either copying an archived file back to its retired source path and
restoring the corresponding manifest entry, or using `git revert <M7-1 commit>`.
