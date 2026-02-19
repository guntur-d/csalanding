# MoriaJS Framework Status Report (v0.4.12)

## ✅ RESOLVED: 1. Missing `dbName` in `MoriaConfig`

This issue was fixed in `@moriajs/core@0.4.8`. The `dbName` property is now correctly typed in the `MoriaConfig` interface.

## Description
The `MoriaConfig` interface in `@moriajs/core` (at `packages/core/src/config.ts`) does not include the `dbName` property within the `database` configuration block. This causes a TypeScript error when trying to configure a MongoDB adapter, which requires a database name.

## Error Message
```text
Object literal may only specify known properties, and 'dbName' does not exist in type '{ adapter?: string | undefined; url?: string | undefined; filename?: string | undefined; usePongo?: boolean | undefined; }'.
```

## Affected Files
- `packages/core/src/config.ts`
- User projects using `moria.config.ts` with MongoDB.

## Steps to Reproduce
1. Create a `moria.config.ts` file in a project.
2. Set `database.adapter` to `'mongo'`.
3. Attempt to set `database.dbName`.
4. Observe the TypeScript error.

## Proposed Fix
Update the `MoriaConfig` interface in `packages/core/src/config.ts` to include `dbName`:

```typescript
database?: {
    adapter?: string;
    url?: string;
    filename?: string;
    usePongo?: boolean;
    dbName?: string; // Add this
};
```

## Workaround
Cast the database configuration or the entire config object to `any` in `moria.config.ts`:

```typescript
database: {
    adapter: 'mongo',
    url: process.env.MONGODB_URI_CUSTOM,
    dbName: 'csa'
} as any
```

---

## ✅ RESOLVED: 2. ESM Module Resolution Error

This issue was fixed in `@moriajs/core@0.4.8` by replacing native `import()` with `vite.ssrLoadModule()` during development. This allows standard ESM imports (using `.js` extensions for `.ts` files) to work correctly.

### Description
In development mode, MoriaJS fails to resolve TypeScript files when they are imported using the standard ESM `.js` extension (e.g., `import { Nav } from './Nav.js'` where the file is actually `Nav.ts`). 

This happens because `@moriajs/core` uses native Node.js `import()` to load routes and middleware, which does not possess the resolution logic provided by Vite.

### Error Message
```text
[moria] Failed to load route: pages/index.ts Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/components/Navigation.js' imported from .../src/routes/pages/index.ts
```

### Affected Files
- `packages/core/src/router.ts`
- Any user project utilizing separate component files with ESM imports.

### Steps to Reproduce
1. Create a route `src/routes/pages/index.ts`.
2. Create a component `src/components/Nav.ts`.
3. In `index.ts`, add `import { Nav } from '../../components/Nav.js'`.
4. Run `moria dev`.
5. Observe the `ERR_MODULE_NOT_FOUND` error in the console.

### Proposed Fix
The framework should use `vite.ssrLoadModule()` instead of native `import()` during development to benefit from Vite's module transformation and resolution.

Update `packages/core/src/router.ts` to accept a `vite` instance and use it for loading:

```typescript
// router.ts
if (vite && mode === 'development') {
    mod = await vite.ssrLoadModule(absolutePath);
} else {
    mod = await import(fileUrl);
}
```

### Workaround
Change all imports in `.ts` source files to use the `.ts` extension explicitly. While this is non-standard for ESM/TS, it allows the current MoriaJS loader to find the files in development.

```typescript
// Change this:
import { Navigation } from '../../components/Navigation.js';

// To this:
import { Navigation } from '../../components/Navigation.ts';
```

**Note**: Using `.ts` extensions in imports requires the following settings in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

---

## 💡 PATTERN RESOLUTION: 3. SSR Data Fetching Crash

### Status: Architectural Workaround
This is not a "bug" that can be fixed with a single line of code in the framework, but rather a limitation of the SSR environment. The framework "resolves" this by requiring the use of `getServerData`.

### Description
Calling `m.request` or `m.redraw` inside a component's lifecycle hooks (like `oninit`) during Server-Side Rendering (SSR) causes the server to crash. 

- `m.request` fails because it attempts to access browser-only globals like `FormData` or `XMLHttpRequest`.
- `m.redraw` fails because the server-side Mithril environment does not have a redraw scheduler (`schedule is not a function`).

### Error Messages
```text
TypeError: Cannot read properties of null (reading 'FormData')
    at .../node_modules/mithril/request/request.js:16:112
```
```text
TypeError: schedule is not a function
    at redraw (.../node_modules/mithril/api/mount-redraw.js:21:4)
```

### Affected Files
- Any component using `m.request` or triggering redraws during initialization.
- `@moriajs/renderer`'s SSR logic.

### Steps to Reproduce
1. Use `m.request` inside a component's `oninit` hook.
2. Render the page using `moria dev`.
3. The server will crash when attempting to render the page to string.

### Proposed Fix
MoriaJS should provide a "safe" fetching utility that defaults to a no-op or a fetch polyfill on the server, or the framework should document that data fetching MUST happen via `getServerData`.

### Workaround (The Moria way)
Avoid `m.request` in component hooks for initial data. Instead, use the `getServerData` export in your route file. MoriaJS will fetch the data on the server, pass it to your component via `attrs.serverData`, and automatically hydrate it on the client.

**Example:**
```typescript
// src/routes/pages/index.ts

// 1. Fetch data on server
export async function getServerData(request: any) {
    const content = await (request.server as any).db.findOne('content', { type: 'landing' });
    return { content };
}

// 2. Use data in component
export default {
    view({ attrs }: any) {
        const content = attrs.serverData?.content || {};
        return m('div', content.title);
    }
}
```

---

## ✅ RESOLVED: 4. Index File Routing Failure

### Description
The framework's `filePathToUrlPath` implementation fails to correctly normalize `index` files that are at the root of a routes directory (e.g., `src/routes/pages/index.ts`). Instead of mapping to `/`, it was mapping to `/index`.

### Affected Files
- `packages/core/src/router.ts`

### Proposed Fix
Update the regex to handle indices at any level:
```typescript
route = route.replace(/(^|\/)index$/, '');
```

---

## ✅ RESOLVED: 5. Hydration Path Matching Failure

### Description
The `@moriajs/renderer`'s `bootstrap` function fails to match client-side pages if the keys in `import.meta.glob` (usually starting with `./`) do not exactly match the `_moria_page` path injected by the server (usually starting with `pages/`).

### Affected Files
- `@moriajs/renderer`'s `bootstrap` logic.
- User's `entry-client.ts`.

### Proposed Fix / Workaround
Normalize keys in `entry-client.ts` before passing them to `bootstrap`:
```typescript
const globbed = import.meta.glob('./routes/pages/**/*.{ts,js}');
const pages = {};
for (const [key, loader] of Object.entries(globbed)) {
    const normalized = key.replace('./routes/', '');
    pages[normalized] = loader;
}
await bootstrap(pages);
```
---

## ❌ UNRESOLVED: 6. Hydration Dynamic Import Failure (Vite Cache Issue)

### Description
During hydration, the browser attempts to fetch pre-bundled dependencies (like `mithril`) from `.vite/deps`, but receives a 404. This causes the app to crash during hydration and can lead to a "flickering" effect where the server HTML is shown briefly then reverts to a default or broken state.

### Error Message
```text
GET http://localhost:3000/node_modules/.vite/deps/mithril-XXXX.js net::ERR_ABORTED 404 (Not Found)
[MoriaJS] Failed to hydrate pages/admin/index.ts: TypeError: Failed to fetch dynamically imported module
```

### Affected Files
- `@moriajs/renderer` (hydration logic)
- Vite dependency pre-bundling

### Recommendation
Clear the Vite cache and restart the dev server with `--force`:
```bash
rm -rf node_modules/.vite
pnpm dev -- --force
```

---

## ✅ RESOLVED: 7. Middleware Handler Not Recognized
- **Issue**: The MoriaJS framework reported `[moria] Middleware file has no handlers: pages/admin/_middleware.ts`.
- **Cause**: The framework requires a `default` export for middleware files, but a named export (`onRequest`) was used.
- **Resolution**: Refactored `src/routes/pages/admin/_middleware.ts` to use `export default defineMiddleware(...)`.

## ✅ RESOLVED: 8. SSR Database Decoration Failure
- **Issue**: `getServerData` reported `TypeError: Cannot read properties of undefined (reading 'findOne')` because `request.server.db` was missing.
- **Cause**: The framework registered routes during `createApp`, before the database plugin had a chance to decorate the server instance via `app.use()`.
- **Resolution**: Patched `@moriajs/core/src/app.ts` to defer route registration until the `listen()` method is called. Added safety checks and `request.log.warn` in `src/routes/pages/admin/index.ts` for missing `db`.

---

## ❌ UPSTREAM BUG: 9. Missing `tsconfig.base.json` in Published Packages
- **Issue**: Individual MoriaJS packages (like `@moriajs/core`, `@moriajs/renderer`, etc.) still `extend` a `tsconfig.base.json` from the monorepo root. This file is NOT included in the published npm/pnpm packages.
- **Impact**: IDEs (VS Code) report errors and fail to provide correct type checking/intellisense for users of the library.
- **Cause**: The `tsconfig.json` files in `node_modules/@moriajs/*/` are identical to the source monorepo files but lack their base dependencies.
- **Resolution**: I have patched these locally to be self-contained. **The MoriaJS team should update their build process to flatten or include the base config in published packages.**

## ✅ RESOLVED: 10. Root Index Routing Failure
- **Issue**: `src/routes/pages/index.ts` was not resolving to `/` correctly.
- **Cause**: Regex failed for root-level index files.
- **Resolution**: Updated regex to `route.replace(/(^|\/)index$/, '')` in `node_modules/@moriajs/core/dist/router.js`.

---

## 📈 IMPROVEMENT: 11. SSR Database Safety
- **Issue**: Potential 500s or crashes if DB decorator is missing during SSR.
## ✅ RESOLVED: 12. Configuration Auto-Registration Failure (Critical)
- **Status**: Resolved in v0.4.13
- **Issue**: Plugins configured in `moria.config.ts` (like `database` and `auth`) are not automatically registered by the framework.
- **Resolution**: The framework now automatically detects and registers `@moriajs/db` and `@moriajs/auth` if their configuration blocks exist. Manual registration in `index.ts` is no longer required and will cause "decorator already added" errors.

### Root Cause Analysis (Code)
In `createApp`:
```javascript
// Missing auto-registration logic for core plugins
const app = {
    // ...
};
return app;
```

### Recommended Fix
Inject auto-registration logic before returning the `app` object:
```javascript
if (config.database) {
    const { createDatabasePlugin } = await import('@moriajs/db');
    await app.use(createDatabasePlugin(config.database));
}
if (config.auth) {
    const { createAuthPlugin } = await import('@moriajs/auth');
    await app.use(createAuthPlugin(config.auth));
}
```

---

## 🚀 ENHANCEMENT: 14. Official Vercel Deployment Support
- **Status**: Suggested / Implementation Pattern
- **Description**: Currently, MoriaJS doesn't have a built-in "Vercel" target. Deploying a MoriaJS SSR app as a static site results in 404s.
- **Proposed Solution**: Include a standard Vercel bridge pattern in the framework or CLI.
    - **vercel.json**: Automatic generation of rewrites for static assets.
    - **Serverless Bridge**: Provide a `createVercelHandler(app)` utility to simplify bridging Fastify to Vercel Functions.
- **Implementation (Reference)**:
    - Create `api/index.ts` to wrap `createApp()`.
    - Export a handler that emits the request to `app.server.server`.
