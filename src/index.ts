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
        // Serve project root for images, styles.css, etc.
        // We use a whitelist of extensions to be safe.
        await app.server.register(fastifyStatic, {
            root: projectRoot,
            prefix: '/',
            allowedPath: (path) => /\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|txt)$/.test(path),
            decorateReply: false
        });

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
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "img-src 'self' data: https://i.ytimg.com",
                "frame-src 'self' https://www.youtube.com https://youtube.com",
                "connect-src 'self' ws://localhost:* wss://localhost:*",
                "font-src 'self' data: https://fonts.gstatic.com"
            ].join('; ');

            reply.header('Content-Security-Policy', csp);

            if (typeof payload === 'string' && payload.includes('<head>')) {
                let processedPayload = payload;

                // Remove any broken/default entry-client.js tags Moria might have injected
                processedPayload = processedPayload.replace(/<script[^>]+src="[^"]*entry-client\.js"[^>]*><\/script>/g, '');

                let headInjection = '';
                if (!processedPayload.includes('styles.css')) {
                    headInjection += '    <link rel="stylesheet" href="/styles.css">\n';
                }
                const assetsDir = path.join(clientDir, 'assets');
                if (fs.existsSync(assetsDir)) {
                    const files = fs.readdirSync(assetsDir);
                    const entryFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
                    if (entryFile) {
                        // Use an absolute path /dist/client/assets/ for reliability
                        headInjection += `    <script type="module" src="/dist/client/assets/${entryFile}"></script>\n`;
                    }
                }
                if (headInjection) {
                    processedPayload = processedPayload.replace('<head>', '<head>\n' + headInjection);
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
        // Try multiple locations for routes since Vercel's bundling can move them
        const searchPaths = [
            path.resolve(projectRoot, config.routes?.dir ?? 'src/routes'),
            path.resolve(__dirname, 'routes'),
            path.resolve(__dirname, '../src/routes'),
            path.resolve(__dirname, '..', 'src', 'routes')
        ];

        let foundRoutes = false;
        for (const routesDir of searchPaths) {
            if (fs.existsSync(routesDir)) {
                console.log(`[Vercel] Found routes at: ${routesDir}`);
                await registerRoutes(app.server, routesDir, {
                    mode: isProd ? 'production' : 'development',
                    config,
                    vite: undefined
                });
                foundRoutes = true;
                break;
            }
        }

        if (!foundRoutes) {
            console.error(`[Vercel] CRITICAL: No routes directory found in: ${searchPaths.join(', ')}`);
        }

        // Diagnostic route
        app.server.get('/vercel-debug', async () => {
            const listFiles = (dir: string, depth = 0): string[] => {
                if (depth > 2 || !fs.existsSync(dir)) return [];
                const files = fs.readdirSync(dir);
                let res: string[] = [];
                for (const f of files) {
                    const p = path.join(dir, f);
                    try {
                        const stat = fs.statSync(p);
                        if (stat.isDirectory()) {
                            res.push(`DIR: ${p}`);
                            res = res.concat(listFiles(p, depth + 1));
                        } else {
                            res.push(`FILE: ${p}`);
                        }
                    } catch (e) { res.push(`ERROR: ${p}`); }
                }
                return res;
            };

            return {
                timestamp: new Date().toISOString(),
                isProd,
                env: process.env.NODE_ENV,
                cwd: process.cwd(),
                dirname: __dirname,
                searchPaths,
                foundRoutes,
                fsRoot: listFiles(projectRoot),
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
        instance.server.server.emit('request', req, res);
    } catch (e: any) {
        console.error('[Vercel] Handler Crash:', e);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message, stack: e.stack }));
    }
};
