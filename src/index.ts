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

        try {
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
                    logger: { level: 'info' },
                    disableRequestLogging: !isProd
                }
            });

            // 1. Static File Serving
            const publicDir = path.resolve(projectRoot, 'public');
            const clientDir = path.resolve(projectRoot, 'dist/client');
            const assetsDir = path.resolve(clientDir, 'assets');

            // Serve public/ on prefix /
            if (fs.existsSync(publicDir)) {
                console.log(`[Vercel] Mounting public: ${publicDir}`);
                await app.server.register(fastifyStatic, {
                    root: publicDir,
                    prefix: '/',
                    decorateReply: false
                });
            }

            // Serve dist/client/assets on prefix /assets
            // This matches Vercel's rewrite source or direct browser requests
            if (fs.existsSync(assetsDir)) {
                console.log(`[Vercel] Mounting assets: ${assetsDir}`);
                await app.server.register(fastifyStatic, {
                    root: assetsDir,
                    prefix: '/assets/',
                    decorateReply: false
                });
            }

            // Fallback for everything else in dist/client
            if (fs.existsSync(clientDir)) {
                await app.server.register(fastifyStatic, {
                    root: clientDir,
                    prefix: '/dist/client/',
                    decorateReply: false
                });
            }

            // 2. Discover correctly hashed assets from dist/client/index.html
            let discoveredAssets: string[] = [];
            const indexHtmlPath = path.join(clientDir, 'index.html');
            if (fs.existsSync(indexHtmlPath)) {
                try {
                    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
                    // Permissive regex for script and link tags
                    const scripts = indexHtml.match(/<script\b[^>]*?\bsrc=["']\/assets\/[^"']+["'][^>]*>.*?<\/script>/gi) || [];
                    const links = indexHtml.match(/<link\b[^>]*?\bhref=["']\/assets\/[^"']+["'][^>]*>/gi) || [];
                    discoveredAssets = [...scripts, ...links];
                    console.log(`[Vercel] Discovered ${discoveredAssets.length} production assets.`);
                } catch (e) {
                    console.error('[Vercel] Asset discovery failed:', e);
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

                // Only inject into HTML pages
                if (typeof payload === 'string' && payload.includes('<head>')) {
                    let processedPayload = payload;

                    // A. Cleanup broken Moria defaults (hardcoded non-hashed paths)
                    processedPayload = processedPayload.replace(/<script[^>]+src="\/assets\/entry-client\.js"[^>]*><\/script>/gi, '');

                    // B. Inject discovered assets ONLY if we found them
                    let headInjection = '';
                    if (discoveredAssets.length > 0) {
                        // Avoid double injection: Remove tags matching our discovered ones if they already exist
                        // (Moria renderer might have tried to inject some)
                        headInjection += '    ' + discoveredAssets.join('\n    ') + '\n';
                    }

                    // C. Styles.css fallback if not in discoveredAssets
                    const hasStyles = processedPayload.includes('styles.css') || headInjection.includes('styles.css');
                    if (!hasStyles) {
                        headInjection += '    <link rel="stylesheet" href="/styles.css">\n';
                    }

                    if (headInjection) {
                        processedPayload = processedPayload.replace('<head>', '<head>\n' + headInjection);
                    }
                    return processedPayload;
                }
                return payload;
            });

            // 4. Register plugins
            try {
                if (config.database) {
                    await app.use(createDatabasePlugin(config.database as any));
                }
                if (config.auth) {
                    await app.use(createAuthPlugin({
                        ...config.auth,
                        secret: config.auth.secret || 'dev-secret-key-csa'
                    } as any));
                }
            } catch (pluginError) {
                console.error('[Vercel] Plugin failure:', pluginError);
            }

            // 5. Route Registration
            const searchPaths = [
                path.resolve(projectRoot, config.routes?.dir ?? 'src/routes'),
                path.resolve(projectRoot, 'src/routes'),
                path.resolve(__dirname, 'routes'),
                path.resolve(__dirname, '..', 'src', 'routes')
            ];

            let routesRegistered = false;
            let lastError: any = null;
            for (const routesDir of searchPaths) {
                if (fs.existsSync(routesDir)) {
                    console.log(`[Vercel] Registering routes from: ${routesDir}`);
                    try {
                        await registerRoutes(app.server, routesDir, {
                            mode: isProd ? 'production' : 'development',
                            config,
                            vite: undefined
                        });
                        routesRegistered = true;
                        break;
                    } catch (routeError) {
                        lastError = routeError;
                        console.error(`[Vercel] Registration error:`, routeError);
                    }
                }
            }

            // Diagnostic route
            app.server.get('/vercel-debug', async () => {
                const listFiles = (dir: string): any[] => {
                    if (!fs.existsSync(dir)) return [];
                    try {
                        return fs.readdirSync(dir).map(file => {
                            const fullPath = path.join(dir, file);
                            const stats = fs.statSync(fullPath);
                            return { name: file, type: stats.isDirectory() ? 'dir' : 'file', size: stats.size };
                        }).slice(0, 50);
                    } catch (e) { return [{ error: String(e) }]; }
                };

                return {
                    timestamp: new Date().toISOString(),
                    isProd,
                    cwd: process.cwd(),
                    discoveredAssets,
                    routesRegistered,
                    lastError: lastError ? lastError.message : null,
                    fs: {
                        root: listFiles(projectRoot),
                        src: listFiles(path.join(projectRoot, 'src')),
                        routes: listFiles(path.join(projectRoot, 'src/routes')),
                        public: listFiles(publicDir),
                        dist: listFiles(clientDir),
                        assets: listFiles(assetsDir)
                    },
                    routes: app.server.printRoutes()
                };
            });

            await app.server.ready();
            return app;
        } catch (initErr: any) {
            console.error('[Vercel] Singleton failure:', initErr);
            throw initErr;
        }
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
            await instance.server.listen({ port, host });
        } catch (err: any) {
            if (err.code !== 'EADDRINUSE') throw err;
        }
    }).catch(console.error);
}

export default async (req: any, res: any) => {
    try {
        const instance = await initApp();
        instance.server.server.emit('request', req, res);
    } catch (e: any) {
        console.error('[Vercel] Handler Crash:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Bridge Initialisation Failed', message: e.message }));
    }
};
