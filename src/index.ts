import 'fastify';
import { createApp, registerRoutes } from '@moriajs/core';
import { createDatabasePlugin } from '@moriajs/db';
import { createAuthPlugin } from '@moriajs/auth';
import config from '../moria.config.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Fix for TypeScript augmentations in serverless
import '@fastify/cookie';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = process.cwd();

let app: any;

/**
 * Initialize the MoriaJS application.
 */
export async function initApp() {
    if (app) return app;

    console.log(`[Vercel] __dirname: ${__dirname}`);
    console.log(`[Vercel] projectRoot (cwd): ${projectRoot}`);

    app = await createApp({
        config: {
            ...config,
            // Omit database and auth to prevent auto-registration crash on Vercel
            database: undefined,
            auth: undefined,
            mode: 'production',
            rootDir: projectRoot,
        },
        fastifyOptions: {
            logger: {
                level: 'info'
            }
        }
    });

    // Add immediate debug route to verify Fastify is alive
    app.server.get('/vercel-debug', async () => ({
        status: 'UP',
        cwd: process.cwd(),
        dirname: __dirname,
        projectRoot,
        configPaths: {
            routes: config.routes?.dir,
            rootDir: config.rootDir
        }
    }));

    // Manually register plugins because auto-registration fails on Vercel
    if (config.database) {
        console.log('[Vercel] Manually registering @moriajs/db');
        try {
            await app.use(createDatabasePlugin(config.database as any));
        } catch (e) {
            console.error('[Vercel] DB Plugin Registration Failed:', e);
        }
    }
    if (config.auth) {
        console.log('[Vercel] Manually registering @moriajs/auth');
        try {
            await app.use(createAuthPlugin({
                ...config.auth,
                secret: config.auth.secret || 'dev-secret-key-csa'
            } as any));
        } catch (e) {
            console.error('[Vercel] Auth Plugin Registration Failed:', e);
        }
    }

    // Manually register routes
    const routesDir = path.resolve(projectRoot, config.routes?.dir ?? 'src/routes');

    if (fs.existsSync(routesDir)) {
        console.log(`[Vercel] Registering routes from: ${routesDir}`);
        try {
            const files = fs.readdirSync(routesDir, { recursive: true });
            console.log(`[Vercel] Route files found: ${JSON.stringify(files)}`);
        } catch (e) {
            console.error(`[Vercel] Failed to list routesDir: ${e}`);
        }

        try {
            await registerRoutes(app.server, routesDir, {
                mode: 'production',
                config,
                vite: undefined
            });
        } catch (e) {
            console.error('[Vercel] registerRoutes Failed:', e);
        }
    } else {
        console.error(`[Vercel] ROUTES DIRECTORY NOT FOUND: ${routesDir}`);
        try {
            // Log structure to help find where it is
            const scan = fs.readdirSync(projectRoot, { recursive: true }).slice(0, 50);
            console.log(`[Vercel] Root scan (partial): ${JSON.stringify(scan)}`);
        } catch (e) { }
    }

    await app.server.ready();
    return app;
}

// Only run standalone if not in a serverless environment
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const instance = await initApp();
    await instance.listen();
}

/**
 * Vercel / serverless handler.
 */
export default async (req: any, res: any) => {
    try {
        const instance = await initApp();
        // Use nextTick to ensure everything is settled before emitting
        process.nextTick(() => {
            instance.server.server.emit('request', req, res);
        });
    } catch (e: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            error: "MoriaJS Initialization Failed",
            message: e.message,
            stack: e.stack
        }));
    }
};
