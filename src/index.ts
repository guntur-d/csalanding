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
                routes: undefined,   // Disable auto-registration to avoid conflicts/double-loading
                mode: isProd ? 'production' : 'development',
                rootDir: projectRoot,
            },
            fastifyOptions: {
                logger: { level: 'info' }
            }
        });

        // 1. Static File Serving
        const publicDir = path.resolve(projectRoot, 'public');
        if (fs.existsSync(publicDir)) {
            console.log(`[Vercel] Mounting static: ${publicDir}`);
            await app.server.register(fastifyStatic, {
                root: publicDir,
                prefix: '/',
                decorateReply: false
            });
        }

        const clientDir = path.resolve(projectRoot, 'dist/client');
        if (fs.existsSync(clientDir)) {
            console.log(`[Vercel] Mounting bundled: ${clientDir}`);
            await app.server.register(fastifyStatic, {
                root: clientDir,
                prefix: '/dist/client/',
                decorateReply: false
            });
        }

        // 2. CSP Relaxation & Asset Injection Hook
        app.server.addHook('onRequest', async (req, reply) => {
            console.log(`[Vercel] Request: ${req.method} ${req.url}`);
            reply.removeHeader('Content-Security-Policy');
        });

        app.server.addHook('onSend', async (request, reply, payload) => {
            const csp = [
                "default-src 'self' https://www.youtube.com https://youtube.com",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://youtube.com",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https://i.ytimg.com",
                "frame-src 'self' https://www.youtube.com https://youtube.com",
                "connect-src 'self' ws://localhost:* wss://localhost:*",
                "font-src 'self' data:"
            ].join('; ');

            reply.header('Content-Security-Policy', csp);

            if (typeof payload === 'string' && payload.includes('<head>')) {
                let headInjection = '';
                if (!payload.includes('styles.css')) {
                    headInjection += '    <link rel="stylesheet" href="/styles.css">\n';
                }
                // Try to find hashed entry-client.js
                if (!payload.includes('entry-client.js')) {
                    const assetsDir = path.join(clientDir, 'assets');
                    if (fs.existsSync(assetsDir)) {
                        const files = fs.readdirSync(assetsDir);
                        const entryFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
                        if (entryFile) {
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
            console.log(`[Vercel] Scanning routes in ${routesDir}`);
            await registerRoutes(app.server, routesDir, {
                mode: isProd ? 'production' : 'development',
                config,
                vite: undefined
            });
        }

        // Diagnostic route
        app.server.get('/vercel-debug', async () => ({
            timestamp: new Date().toISOString(),
            isProd,
            env: process.env.NODE_ENV,
            cwd: process.cwd(),
            routesDirExists: fs.existsSync(routesDir),
            routes: app.server.printRoutes()
        }));

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
            console.log(`[Moria] Environment: Non-Vercel. Listening on ${port}`);
            const addr = await instance.server.listen({ port, host });
            console.log(`[Moria] Local Standalone Server: ${addr}`);
        } catch (err: any) {
            if (err.code !== 'EADDRINUSE') throw err;
            console.log('[Moria] Standalone port in use.');
        }
    }).catch(console.error);
}

/**
 * Vercel Serverless Handler
 */
export default async (req: any, res: any) => {
    try {
        const instance = await initApp();
        // Fastify 5 Bridge
        instance.server.server.emit('request', req, res);
    } catch (e: any) {
        console.error('[Vercel] Handler Crash:', e);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
    }
};
