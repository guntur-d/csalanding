/// <reference types="vite/client" />
import { bootstrap } from '@moriajs/renderer';

// Force referrer policy for YouTube embeds
const meta = document.createElement('meta');
meta.name = "referrer";
meta.content = "origin";
document.head.appendChild(meta);

// Discover all page files, excluding server-only files (starting with _)
const globbed = import.meta.glob(['./routes/**/*.{ts,js,mts,mjs}', '!./routes/**/_*.{ts,js,mts,mjs}', '!./routes/api/**']);

// Robustly map glob keys to the identifiers used by the MoriaJS server
// e.g. "./routes/pages/admin/index.ts" -> "pages/admin/index.ts"
// and handles both .ts and .js since the server might report either
const pages: Record<string, () => Promise<any>> = {};
for (const [key, loader] of Object.entries(globbed)) {
    // 1. Standard file path (e.g. "admin/login.ts")
    const relativePath = key.replace('./routes/', '');
    pages[relativePath] = loader as any;

    // 2. JS Extension compatibility (e.g. "admin/login.js")
    if (relativePath.endsWith('.ts')) {
        pages[relativePath.replace(/\.ts$/, '.js')] = loader as any;
    }

    // 3. URL-style matching (Critical for path matching against server's _moria_page)
    // Remove extension
    const token = relativePath.replace(/\.(ts|js|mts|mjs)$/, ''); // "admin/login", "index"

    // Add exact match (e.g. "/admin/login")
    pages['/' + token] = loader as any;

    // Add index aliases
    if (token.endsWith('/index')) {
        const folder = token.replace(/\/index$/, '');
        pages['/' + folder] = loader as any; // "/admin"
    } else if (token === 'index') {
        pages['/'] = loader as any; // "/"
    }
}

(async () => {
    await bootstrap(pages as any);
})();
