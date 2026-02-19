import 'fastify';
import { createApp, registerRoutes } from '@moriajs/core';
import { createDatabasePlugin } from '@moriajs/db';
import { createAuthPlugin } from '@moriajs/auth';
import config from '../moria.config.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';

// Fix for TypeScript augmentations in serverless
import '@fastify/cookie';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = process.cwd();

/**
 * Singleton Initialization Promise
 * Uses globalThis to persist across hot-reloads in Vercel Dev.
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
                database: undefined, // Manual registration below
                auth: undefined,
                mode: isProd ? 'production' : 'development',
                rootDir: projectRoot,
            },
            fastifyOptions: {
                logger: { level: 'info' }
            }
        });

        // 1. Static File Serving (Bridge for Vercel/Local consistency)
        // Serve public folder for images, styles.css, etc.
        const publicDir = path.resolve(projectRoot, 'public');
        if (fs.existsSync(publicDir)) {
            console.log(`[Vercel] Serving static files from ${publicDir}`);
            await app.server.register(fastifyStatic, {
                root: publicDir,
                prefix: '/',
                decorateReply: false // Don't conflict with potential second registration
            });
        }

        // Serve dist/client for bundled assets
        const clientDir = path.resolve(projectRoot, 'dist/client');
        if (fs.existsSync(clientDir)) {
            console.log(`[Vercel] Serving bundled client files from ${clientDir}`);
            await app.server.register(fastifyStatic, {
                root: clientDir,
                prefix: '/dist/client/',
                decorateReply: false
            });
        }

        // 2. CSP Relaxation & Asset Injection Hook
        app.server.addHook('onSend', async (request, reply, payload) => {
            // Set a permissive CSP for external embeds and Moria hydration
            const csp = [
                "default-src 'self' https://www.youtube.com https://youtube.com",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://youtube.com",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https://i.ytimg.com",
                "frame-src 'self' https://www.youtube.com https://youtube.com",
                "connect-src 'self' ws://localhost:* wss://localhost:*", // Allow Vite HMR ws
                "font-src 'self' data:"
            ].join('; ');

            reply.header('Content-Security-Policy', csp);

            // Manual Asset Injection for Production Bridge
            if (typeof payload === 'string' && payload.includes('<head>')) {
                let headInjection = '';

                // Inject styles.css if found in public
                if (!payload.includes('styles.css') && fs.existsSync(path.join(publicDir, 'styles.css'))) {
                    headInjection += '    <link rel="stylesheet" href="/styles.css">\n';
                }

                // Inject hashed entry-client.js if found
                if (!payload.includes('entry-client.js')) {
                    const assetsDir = path.join(clientDir, 'assets');
                    if (fs.existsSync(assetsDir)) {
                        const files = fs.readdirSync(assetsDir);
                        const entryFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
                        if (entryFile) {
                            console.log(`[Vercel] Found hashed entry: ${entryFile}`);
                            headInjection += `    <script type="module" src="/assets/${entryFile}"></script>\n`;
                        }
                    }
                }

                if (headInjection) {
                    payload = payload.replace('<head>', '<head>\n' + headInjection);
                }
            }
            return payload;
        });

        // 3. Manually register plugins
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

        // 4. Register file-based routes
        const routesDir = path.resolve(projectRoot, config.routes?.dir ?? 'src/routes');
        if (fs.existsSync(routesDir)) {
            console.log(`[Vercel] Registering routes from ${routesDir}`);
            await registerRoutes(app.server, routesDir, {
                mode: isProd ? 'production' : 'development',
                config,
                vite: undefined
            });
        }

        await app.server.ready();
        return app;
    })();

    (globalThis as any)._MORIA_INIT_PROMISE = initPromise;
    return initPromise;
}

/**
 * Standalone Mode Detection
 * Strictly avoid listen() under Vercel Proxy (Production or Dev).
 */
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
            console.log(`[Moria] Local Standalone Server: ${addr}`);
        } catch (err: any) {
            if (err.code !== 'EADDRINUSE') throw err;
            console.log('[Moria] Standalone port in use, assuming dev is already running.');
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
