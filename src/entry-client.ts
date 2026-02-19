/// <reference types="vite/client" />
import '../styles.css';
import { bootstrap } from '@moriajs/renderer';

// Force referrer policy for YouTube embeds
const meta = document.createElement('meta');
meta.name = "referrer";
meta.content = "origin";
document.head.appendChild(meta);

// Discover all page files
const globbed = import.meta.glob('./routes/pages/**/*.{ts,js,mts,mjs}');

// Robustly map glob keys to the identifiers used by the MoriaJS server
// e.g. "./routes/pages/admin/index.ts" -> "pages/admin/index.ts"
// and handles both .ts and .js since the server might report either
const pages: Record<string, () => Promise<any>> = {};
for (const [key, loader] of Object.entries(globbed)) {
    const normalized = key.replace('./routes/', '');
    pages[normalized] = loader as any;

    // Also include .js version for matching if server reports as .js
    if (normalized.endsWith('.ts')) {
        pages[normalized.replace(/\.ts$/, '.js')] = loader as any;
    }
}

await bootstrap(pages as any);
