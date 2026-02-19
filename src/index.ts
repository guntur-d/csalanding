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

            // 1. Path Resolution (Auto-detecting Vercel vs Local)
            const publicDir = path.resolve(projectRoot, 'public');

            // Search for content root: dist/client (local) or dist (vercel)
            const possibleContentRoots = [
                path.resolve(projectRoot, 'dist/client'),
                path.resolve(projectRoot, 'dist'),
            ];

            let contentDir = possibleContentRoots[0];
            for (const r of possibleContentRoots) {
                if (fs.existsSync(path.join(r, 'index.html'))) {
                    contentDir = r;
                    break;
                }
            }

            const assetsDir = path.join(contentDir, 'assets');
            console.log(`[Vercel] Resolved contentDir: ${contentDir}, assetsDir: ${assetsDir}`);

            // 2. Static File Serving (Root level)
            const staticRoots: string[] = [];
            if (fs.existsSync(publicDir)) staticRoots.push(publicDir);
            if (fs.existsSync(contentDir)) staticRoots.push(contentDir);

            if (staticRoots.length > 0) {
                console.log(`[Vercel] Mounting static roots: ${staticRoots.join(', ')}`);
                await app.server.register(fastifyStatic, {
                    root: staticRoots,
                    prefix: '/',
                    decorateReply: true, // Enable sendFile
                    index: false
                });
            }

            // 3. Asset Discovery (Sync with hashed Vite assets)
            let discoveredAssets: string[] = [];
            const indexHtmlPath = path.join(contentDir, 'index.html');
            if (fs.existsSync(indexHtmlPath)) {
                try {
                    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
                    const scripts = indexHtml.match(/<script\b[^>]*?\bsrc=["']\/assets\/[^"']+["'][^>]*>.*?<\/script>/gi) || [];
                    const links = indexHtml.match(/<link\b[^>]*?\bhref=["']\/assets\/[^"']+["'][^>]*>/gi) || [];
                    discoveredAssets = [...scripts, ...links];
                    console.log(`[Vercel] Discovered ${discoveredAssets.length} production assets.`);
                } catch (e) {
                    console.error('[Vercel] Asset discovery failed:', e);
                }
            }

            // 4. Request Hooks
            // A. CSP & Headers
            app.server.addHook('onRequest', async (req, reply) => {
                reply.removeHeader('Content-Security-Policy');
            });

            // B. Assets Bypass (Fixes 404s caused by Moria's default /assets/ route or Vercel routing)
            app.server.addHook('onRequest', async (req, reply) => {
                const url = req.url.split('?')[0];
                if (url.startsWith('/assets/') && !url.includes('..')) {
                    const fileName = url.replace('/assets/', '');
                    // Try to find the file in the resolved assets directory
                    const filePath = path.join(assetsDir, fileName);
                    if (fs.existsSync(filePath)) {
                        console.log(`[Vercel] Serving asset via bridge-bypass: ${fileName}`);
                        return reply.sendFile(fileName, assetsDir);
                    } else {
                        console.warn(`[Vercel] Asset not found at ${filePath}`);
                    }
                }
            });

            // C. Asset Injection (Post-rendering)
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

                    // Cleanup broken defaults
                    processedPayload = processedPayload.replace(/<script[^>]+src="\/assets\/entry-client\.js"[^>]*><\/script>/gi, '');

                    // Inject discovered assets
                    let headInjection = '';
                    if (discoveredAssets.length > 0) {
                        processedPayload = processedPayload.replace(/<link[^>]+href="\/assets\/[^"]+"[^>]*>/gi, '');
                        headInjection += '    ' + discoveredAssets.join('\n    ') + '\n';
                    }

                    // Styles.css fallback
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

            // 5. Plugins & Routes
            try {
                if (config.database) await app.use(createDatabasePlugin(config.database as any));
                if (config.auth) await app.use(createAuthPlugin({ ...config.auth, secret: config.auth.secret || 'dev-secret-key-csa' } as any));
            } catch (e) { console.error('[Vercel] Plugin failure:', e); }

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
                        await registerRoutes(app.server, routesDir, { mode: isProd ? 'production' : 'development', config, vite: undefined });
                        routesRegistered = true;
                        break;
                    } catch (e) { lastError = e; console.error('[Vercel] Registration error:', e); }
                }
            }

            // Diagnostic route
            app.server.get('/vercel-debug', async () => {
                const listFiles = (dir: string): any[] => {
                    if (!fs.existsSync(dir)) return [];
                    try {
                        return fs.readdirSync(dir).map(file => {
                            const stats = fs.statSync(path.join(dir, file));
                            return { name: file, type: stats.isDirectory() ? 'dir' : 'file', size: stats.size };
                        }).slice(0, 50);
                    } catch (e) { return [{ error: String(e) }]; }
                };

                return {
                    timestamp: new Date().toISOString(),
                    isProd,
                    cwd: process.cwd(),
                    contentDir,
                    assetsDir,
                    discoveredAssets,
                    routesRegistered,
                    lastError: lastError ? lastError.message : null,
                    fs: {
                        root: listFiles(projectRoot),
                        dist: listFiles(path.join(projectRoot, 'dist')),
                        client: listFiles(path.join(projectRoot, 'dist/client')),
                        public: listFiles(publicDir)
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
        try { await instance.server.listen({ port, host }); } catch (err: any) { if (err.code !== 'EADDRINUSE') throw err; }
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
