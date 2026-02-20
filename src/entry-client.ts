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
const routes = Object.entries(globbed).sort((a, b) => b[0].split('/').length - a[0].split('/').length);

for (const [key, loader] of routes) {
    const relativePath = key.replace('./routes/', '');
    const token = relativePath.replace(/\.(ts|js|mts|mjs)$/, '');

    // Exact file path key (used by hydration)
    pages[relativePath] = loader as any;

    // JS alias for TS files
    if (relativePath.endsWith('.ts')) {
        pages[relativePath.replace(/\.ts$/, '.js')] = loader as any;
    }

    // URL path aliases
    const urlPath = '/' + token;
    if (!pages[urlPath]) pages[urlPath] = loader as any;

    if (token.endsWith('/index')) {
        const folderPath = '/' + token.replace(/\/index$/, '');
        if (!pages[folderPath]) {
            pages[folderPath] = loader as any;
            console.log(`[ROUTING] Alias ${folderPath} -> ${relativePath}`);
        }
    } else if (token === 'index') {
        if (!pages['/']) {
            pages['/'] = loader as any;
            console.log(`[ROUTING] Alias / -> ${relativePath}`);
        }
    }
}

console.log("[ROUTING] Global pages:", Object.keys(pages));

if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => console.error('[GLOBAL ERROR]', e));
    window.addEventListener('unhandledrejection', (e) => console.error('[UNHANDLED REJECTION]', e));
}

(async () => {
    console.log("[MoriaJS] Bootstrapping client...");
    try {
        await bootstrap(pages as any);
        console.log("[MoriaJS] Hydration check complete");
    } catch (e) {
        console.error("[MoriaJS] Hydration failed at root:", e);
    }
})();
