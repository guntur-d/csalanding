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
                    decorateReply: false,
                    index: false // Don't serve index.html for root, let Moria handle it
                });
            }

            // 2. Discover correctly hashed assets from dist/client/index.html
            let productionAssets = '';
            if (isProd) {
                const indexHtmlPath = path.join(clientDir, 'index.html');
                if (fs.existsSync(indexHtmlPath)) {
                    try {
                        const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
                        const scriptMatches = indexHtml.match(/<script[^>]+src="\/assets\/[^"]+"[^>]*><\/script>/g) || [];
                        const linkMatches = indexHtml.match(/<link[^>]+href="\/assets\/[^"]+"[^>]*>/g) || [];
                        productionAssets = [...scriptMatches, ...linkMatches].join('\n    ');
                        console.log(`[Vercel] Discovered production assets.`);
                    } catch (e) {
                        console.error('[Vercel] Asset discovery failed:', e);
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

                    // B. Inject discovered assets
                    let headInjection = '';
                    if (productionAssets) {
                        // Remove existing assets to avoid duplicates
                        processedPayload = processedPayload.replace(/<link[^>]+href="\/assets\/[^"]+"[^>]*>/g, '');
                        headInjection += `    ${productionAssets}\n`;
                    }

                    // C. Styles.css fallback if not in productionAssets
                    if (!processedPayload.includes('styles.css') && !headInjection.includes('styles.css')) {
                        headInjection += '    <link rel="stylesheet" href="/styles.css">\n';
                    }

                    if (headInjection) {
                        processedPayload = processedPayload.replace('<head>', '<head>\n' + headInjection);
                    }
                    return processedPayload;
                }
                return payload;
            });

            // 4. Register plugins with error isolation
            try {
                if (config.database) {
                    console.log('[Vercel] Registering DB plugin');
                    await app.use(createDatabasePlugin(config.database as any));
                }
                if (config.auth) {
                    console.log('[Vercel] Registering Auth plugin');
                    await app.use(createAuthPlugin({
                        ...config.auth,
                        secret: config.auth.secret || 'dev-secret-key-csa'
                    } as any));
                }
            } catch (pluginError) {
                console.error('[Vercel] Plugin registration failed:', pluginError);
            }

            // 5. Robust Route Registration
            const searchPaths = [
                path.resolve(projectRoot, config.routes?.dir ?? 'src/routes'),
                path.resolve(__dirname, 'routes'),
                path.resolve(__dirname, '..', 'src', 'routes')
            ];

            let routesRegistered = false;
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
                        console.error(`[Vercel] Failed to register routes from ${routesDir}:`, routeError);
                    }
                }
            }

            // Diagnostic route
            app.server.get('/vercel-debug', async () => {
                const listFiles = (dir: string): any[] => {
                    if (!fs.existsSync(dir)) return [];
                    return fs.readdirSync(dir).map(file => {
                        const fullPath = path.join(dir, file);
                        const stats = fs.statSync(fullPath);
                        if (stats.isDirectory()) {
                            return { name: file, type: 'dir', children: listFiles(fullPath).slice(0, 10) }; // Cap for depth
                        }
                        return { name: file, type: 'file', size: stats.size };
                    });
                };

                return {
                    timestamp: new Date().toISOString(),
                    isProd,
                    cwd: process.cwd(),
                    productionAssets,
                    routesRegistered,
                    fs: {
                        public: listFiles(publicDir),
                        dist: listFiles(clientDir)
                    },
                    routes: app.server.printRoutes()
                };
            });

            await app.server.ready();
            return app;
        } catch (initErr) {
            console.error('[Vercel] Singleton Init Error:', initErr);
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
        console.error('[Vercel] Lambda Handler Crash:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            error: 'Bridge Critical Failure',
            message: e.message,
            stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
        }));
    }
};
