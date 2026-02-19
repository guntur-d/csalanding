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
        // Combine multiple roots into a single registration to avoid route collisions (e.g. HEAD /*)
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

        // 2. CSP Relaxation & Asset Injection Hook
        app.server.addHook('onRequest', async (req, reply) => {
            // Log for debugging
            if (req.url.includes('.css') || req.url.includes('.js') || req.url.includes('.jpg') || req.url.includes('.png')) {
                console.log(`[Vercel] Asset Request: ${req.method} ${req.url}`);
            }
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

                // 1. Absolute styles.css injection
                if (!processedPayload.includes('styles.css')) {
                    processedPayload = processedPayload.replace('<head>', '<head>\n    <link rel="stylesheet" href="/styles.css">');
                }

                // 2. Cleanup and Absolute Hashed Entry Injection
                // Remove ANY script that looks like entry-client (Moria default)
                processedPayload = processedPayload.replace(/<script[^>]+src="[^"]*entry-client\.js"[^>]*><\/script>/g, '');

                const assetsDir = path.join(clientDir, 'assets');
                if (fs.existsSync(assetsDir)) {
                    const files = fs.readdirSync(assetsDir);
                    const entryFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
                    if (entryFile) {
                        const entryPath = `/assets/${entryFile}`;
                        console.log(`[Vercel] Injecting script: ${entryPath}`);
                        processedPayload = processedPayload.replace('<head>', `<head>\n    <script type="module" src="${entryPath}"></script>`);
                    }
                }

                return processedPayload;
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

        // 4. Robust Route Registration
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
                searchPaths,
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
