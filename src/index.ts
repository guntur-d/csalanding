import 'fastify';
import { createApp, registerRoutes } from '@moriajs/core';
import { createDatabasePlugin } from '@moriajs/db';
import { createAuthPlugin } from '@moriajs/auth';
import config from '../moria.config.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';

// Fix for dependencies missed by Vercel NFT bundler
import 'mithril-node-render';
import '@fastify/cookie';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = process.cwd();

/**
 * Singleton Initialization Promise
 */
let initPromise: Promise<any> | null = (globalThis as any)._MORIA_INIT_PROMISE || null;

export async function initApp() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
        console.log(`[Vercel] Singleton Initializing. Mode: ${isProd ? 'production' : 'development'}, CWD: ${projectRoot}`);

        const app = await createApp({
            config: {
                ...config,
                database: undefined, // Manual
                auth: undefined,
                routes: undefined,   // Manual
                mode: isProd ? 'production' : 'development',
                rootDir: projectRoot,
            },
            fastifyOptions: {
                logger: { level: 'info' }
            }
        });

        // 1. Static File Serving (Bridge for Vercel/Local consistency)
        const staticRoots: string[] = [];
        const publicDir = path.resolve(projectRoot, 'public');
        if (fs.existsSync(publicDir)) {
            staticRoots.push(publicDir);
        }
        const clientDir = path.resolve(projectRoot, 'dist/client');
        if (fs.existsSync(clientDir)) {
            staticRoots.push(clientDir);
        }

        if (staticRoots.length > 0) {
            console.log(`[Vercel] Mounting static roots: ${staticRoots.join(', ')}`);
            await app.server.register(fastifyStatic, {
                root: staticRoots,
                prefix: '/',
                decorateReply: false
            });
        }

        // 2. Discover correctly hashed assets from dist/client/index.html
        let productionAssets = '';
        if (isProd) {
            const indexHtmlPath = path.join(clientDir, 'index.html');
            if (fs.existsSync(indexHtmlPath)) {
                try {
                    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
                    // Extract <script> and <link> tags from the <head>
                    const scriptMatches = indexHtml.match(/<script[^>]+src="\/assets\/[^"]+"[^>]*><\/script>/g) || [];
                    const linkMatches = indexHtml.match(/<link[^>]+href="\/assets\/[^"]+"[^>]*>/g) || [];
                    productionAssets = [...scriptMatches, ...linkMatches].join('\n    ');
                    console.log(`[Vercel] Discovered production assets:\n${productionAssets}`);
                } catch (e) {
                    console.error('[Vercel] Failed to read dist/client/index.html for asset discovery', e);
                }
            }
        }

        // 3. CSP & Asset Injection Hook
        app.server.addHook('onRequest', async (req, reply) => {
            reply.removeHeader('Content-Security-Policy');
        });

        app.server.addHook('onSend', async (request, reply, payload) => {
            const csp = [
                "default-src 'self' https://www.youtube.com https://youtube.com",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://youtube.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "img-src 'self' data: https://i.ytimg.com",
                "frame-src 'self' https://www.youtube.com https://youtube.com",
                "connect-src 'self' ws://localhost:* wss://localhost:*",
                "font-src 'self' data: https://fonts.gstatic.com"
            ].join('; ');

            reply.header('Content-Security-Policy', csp);

            if (typeof payload === 'string' && payload.includes('<head>')) {
                let processedPayload = payload;

                // A. Cleanup broken Moria defaults
                processedPayload = processedPayload.replace(/<script[^>]+src="[^"]*entry-client\.js"[^>]*><\/script>/g, '');
                processedPayload = processedPayload.replace(/<link[^>]+href="\/assets\/[^"]+"[^>]*>/g, (match) => {
                    // Only remove if we have discovered production assets to replace them with
                    return productionAssets ? '' : match;
                });

                // B. Inject discovered assets or fallback
                let headInjection = '';
                if (productionAssets) {
                    headInjection += `    ${productionAssets}\n`;
                }

                // C. Ensure styles.css from public is also included if missing
                if (!processedPayload.includes('styles.css') && fs.existsSync(path.join(publicDir, 'styles.css'))) {
                    headInjection += '    <link rel="stylesheet" href="/styles.css">\n';
                }

                if (headInjection) {
                    processedPayload = processedPayload.replace('<head>', '<head>\n' + headInjection);
                }
                return processedPayload;
            }
            return payload;
        });

        // 4. Manually register plugins
        if (config.database) {
            console.log('[Vercel] Registering @moriajs/db');
            await app.use(createDatabasePlugin(config.database as any));
        }
        if (config.auth) {
            console.log('[Vercel] Registering @moriajs/auth');
            await app.use(createAuthPlugin({
                ...config.auth,
                secret: config.auth.secret || 'dev-secret-key-csa'
            } as any));
        }

        // 5. Robust Route Registration
        const searchPaths = [
            path.resolve(projectRoot, config.routes?.dir ?? 'src/routes'),
            path.resolve(__dirname, 'routes'),
            path.resolve(__dirname, '..', 'src', 'routes')
        ];

        let foundRoutes = false;
        for (const routesDir of searchPaths) {
            if (fs.existsSync(routesDir)) {
                console.log(`[Vercel] Registering routes from: ${routesDir}`);
                await registerRoutes(app.server, routesDir, {
                    mode: isProd ? 'production' : 'development',
                    config,
                    vite: undefined
                });
                foundRoutes = true;
                break;
            }
        }

        // Diagnostic route
        app.server.get('/vercel-debug', async () => {
            return {
                timestamp: new Date().toISOString(),
                isProd,
                cwd: process.cwd(),
                dirname: __dirname,
                productionAssets,
                foundRoutes,
                routes: app.server.printRoutes()
            };
        });

        await app.server.ready();
        return app;
    })();

    (globalThis as any)._MORIA_INIT_PROMISE = initPromise;
    return initPromise;
}

const isVercelRuntime = !!(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.NOW_REGION ||
    process.env.VC_NODE_RUNTIME ||
    process.env.FUNCTIONS_CONTROL_API
);

if (!isVercelRuntime) {
    initApp().then(async (instance) => {
        const port = config.server?.port || 3001;
        const host = config.server?.host || '0.0.0.0';
        try {
            const addr = await instance.server.listen({ port, host });
            console.log(`[Moria] Standalone Server: ${addr}`);
        } catch (err: any) {
            if (err.code !== 'EADDRINUSE') throw err;
        }
    }).catch(console.error);
}

/**
 * Vercel Serverless Handler
 */
export default async (req: any, res: any) => {
    try {
        const instance = await initApp();
        instance.server.server.emit('request', req, res);
    } catch (e: any) {
        console.error('[Vercel] Handler Crash:', e);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
    }
};
