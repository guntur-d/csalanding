import 'fastify';
import { createApp } from '@moriajs/core';
import { createDatabasePlugin } from '@moriajs/db';
import { createAuthPlugin } from '@moriajs/auth';
import { renderToString } from '@moriajs/renderer';
import config from '../moria.config.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';

// Static Route Imports for Vercel Bundling
import * as HomeRoute from './routes/index.js';
import * as AdminRoute from './routes/admin/index.js';
import * as AdminLoginRoute from './routes/admin/login.js';
import AdminMiddleware from './routes/admin/_middleware.js';
import * as ContentApi from './routes/api/content.js';
import * as AuthLoginApi from './routes/api/auth/login.js';
import * as InquiryApi from './routes/api/inquiry.js';
import * as AuthLogoutApi from './routes/api/auth/logout.js';
import * as MediaApi from './routes/api/media/index.js';
import * as MediaIdApi from './routes/api/media/[id].js';

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
            const manifestPath = path.join(contentDir, '.vite/manifest.json');

            if (fs.existsSync(indexHtmlPath)) {
                try {
                    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
                    const scripts = indexHtml.match(/<script\b[^>]*?\bsrc=["']\/assets\/[^"']+["'][^>]*>.*?<\/script>/gi) || [];
                    const links = indexHtml.match(/<link\b[^>]*?\bhref=["']\/assets\/[^"']+["'][^>]*>/gi) || [];
                    discoveredAssets = [...scripts, ...links];
                    console.log(`[Vercel] Discovered ${discoveredAssets.length} production assets from index.html`);
                } catch (e) {
                    console.error('[Vercel] Asset discovery from index.html failed:', e);
                }
            } else if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    console.log(`[Vercel] Using manifest for discovery at ${manifestPath}`);

                    // 1. Find Entry Client
                    const entryPath = config.vite?.clientEntry?.replace(/^\//, '') || 'src/entry-client.ts';
                    const entry = manifest[entryPath];
                    if (entry) {
                        discoveredAssets.push(`<script type="module" src="/${entry.file}"></script>`);

                        // 2. Find Styles (if any)
                        if (entry.css) {
                            entry.css.forEach((cssFile: string) => {
                                discoveredAssets.push(`<link rel="stylesheet" href="/${cssFile}">`);
                            });
                        }
                    } else {
                        console.warn(`[Vercel] Entry ${entryPath} not found in manifest`);
                    }
                    console.log(`[Vercel] Discovered ${discoveredAssets.length} assets from manifest.`);
                } catch (e) {
                    console.error('[Vercel] Asset discovery from manifest failed:', e);
                }
            } else {
                console.warn(`[Vercel] No asset discovery source found (searched index.html and manifest.json)`);
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

            // C. Asset Injection Helper
            const injectAssets = (html: string) => {
                let processedPayload = html;

                // Inject discovered assets
                let headInjection = '';
                if (discoveredAssets.length > 0) {
                    // Cleanup broken defaults only if we have replacements
                    processedPayload = processedPayload.replace(/<script[^>]+src="\/assets\/entry-client\.js"[^>]*><\/script>/gi, '');
                    // Remove duplicate links if any
                    processedPayload = processedPayload.replace(/<link[^>]+href="\/assets\/[^"]+"[^>]*>/gi, '');
                    headInjection += '    ' + discoveredAssets.join('\n    ') + '\n';
                }

                // Styles.css fallback if not found in discovered assets
                const hasStyles = processedPayload.includes('styles.css') || headInjection.includes('styles.css') || discoveredAssets.some(a => a.includes('.css'));
                if (!hasStyles) {
                    headInjection += '    <link rel="stylesheet" href="/styles.css">\n';
                }

                if (headInjection) {
                    processedPayload = processedPayload.replace('<head>', '<head>\n' + headInjection);
                }

                // Inject Chatbot Iframe
                const chatbotIframe = `
    <iframe src="https://letsiti.work/chat-frame.html?apiKey=client_u01a4n03u8gj4rzc0kguf" 
            style="position:fixed; bottom:20px; right:20px; width:400px; height:600px; border:none; z-index: 9999;">
    </iframe>
`;
                processedPayload = processedPayload.replace('<body>', '<body>' + chatbotIframe);

                return processedPayload;
            };



            // 5. Plugins & MANUEL Route Registration (Bypassing filesystem scanner for Vercel)
            try {
                if (config.database) await app.use(createDatabasePlugin(config.database as any));
                if (config.auth) await app.use(createAuthPlugin({ ...config.auth, secret: config.auth.secret || 'dev-secret-key-csa' } as any));
            } catch (e) { console.error('[Vercel] Plugin failure:', e); }

            // Helper for registering Mithril Pages
            const registerPage = (path: string, componentModule: any, middleware?: any, pageId?: string) => {
                console.log(`[Vercel] Registering Manual Route: ${path}`, Object.keys(componentModule));

                const handler = async (req: any, reply: any) => {
                    console.log(`[Vercel] Handling request for: ${path}`);
                    try {
                        // CSP Headers
                        const csp = [
                            "default-src 'self' https://www.youtube.com https://youtube.com",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://youtube.com https://letsiti.work https://unpkg.com",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "img-src 'self' data: https://i.ytimg.com https://letsiti.work",
                            "frame-src 'self' https://www.youtube.com https://youtube.com https://letsiti.work",
                            "connect-src 'self' ws://localhost:* wss://localhost:* https://letsiti.work",
                            "font-src 'self' data: https://fonts.gstatic.com"
                        ].join('; ');
                        reply.header('Content-Security-Policy', csp);

                        if (!componentModule.default) {
                            throw new Error(`Component default export missing for ${path}`);
                        }

                        console.log(`[Vercel] Fetching server data for ${path}...`);
                        const data = componentModule.getServerData ? await componentModule.getServerData(req) : {};

                        console.log(`[Vercel] Rendering ${path}...`);
                        const rawHtml = await renderToString(componentModule.default, {
                            title: componentModule.default.title || 'CSA Marketing',
                            mode: isProd ? 'production' : 'development',
                            initialData: {
                                ...data,
                                _moria_page: pageId || path
                            }
                        });

                        const finalHtml = injectAssets(rawHtml);

                        console.log(`[Vercel] Render complete (${finalHtml.length} bytes). Returning response.`);
                        reply.type('text/html');
                        return finalHtml;
                    } catch (err: any) {
                        console.error(`[Vercel] Handler Error for ${path}:`, err);
                        return reply.status(500).send(`Server Error: ${err.message}`);
                    }
                };

                if (middleware) {
                    app.server.get(path, { preHandler: middleware }, handler);
                } else {
                    app.server.get(path, handler);
                }
            };

            // Register Pages
            registerPage('/', HomeRoute, undefined, 'index.js');
            registerPage('/admin', AdminRoute, AdminMiddleware, 'admin/index.js');
            registerPage('/admin/login', AdminLoginRoute, undefined, 'admin/login.js');

            // Simple Test Route
            app.server.get('/vercel-test', async (req, reply) => {
                return { status: 'ok', message: 'Bridge is working' };
            });

            // Register API
            console.log('[Vercel] Registering Manual API Routes');
            app.server.get('/api/content', ContentApi.GET);
            app.server.post('/api/content', ContentApi.POST);
            app.server.post('/api/auth/login', AuthLoginApi.POST);

            // Inquiry API
            app.server.post('/api/inquiry', InquiryApi.POST);
            app.server.get('/api/inquiry', InquiryApi.GET);

            // Media & Auth Extension
            app.server.post('/api/auth/logout', AuthLogoutApi.POST);
            app.server.post('/api/media', MediaApi.POST);
            app.server.get('/api/media/:id', MediaIdApi.GET);


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
                    routesRegistered: 'MANUAL',
                    fs: {
                        root: listFiles(projectRoot),
                        dist: listFiles(path.join(projectRoot, 'dist')),
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

export default (req: any, res: any) => {
    initApp().then(instance => {
        instance.server.server.emit('request', req, res);
    }).catch((e: any) => {
        console.error('[Vercel] Handler Crash:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Bridge Initialisation Failed', message: e.message }));
    });
};
