import 'fastify';
import { createApp, registerRoutes } from '@moriajs/core';
import { createDatabasePlugin } from '@moriajs/db';
import { createAuthPlugin } from '@moriajs/auth';
import config from '../moria.config.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In Vercel, everything is flattened. Let's try to find the root.
const projectRoot = process.cwd();

let app: any;

/**
 * Initialize the MoriaJS application.
 */
export async function initApp() {
    if (app) return app;

    console.log(`[Vercel] __dirname: ${__dirname}`);
    console.log(`[Vercel] projectRoot (cwd): ${projectRoot}`);

    try {
        console.log(`[Vercel] root contents: ${JSON.stringify(fs.readdirSync(projectRoot))}`);
    } catch (e) { }

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

    // Manually register plugins
    if (config.database) {
        console.log('[Vercel] Manually registering @moriajs/db');
        await app.use(createDatabasePlugin(config.database as any));
    }
    if (config.auth) {
        console.log('[Vercel] Manually registering @moriajs/auth');
        await app.use(createAuthPlugin({
            ...config.auth,
            secret: config.auth.secret || 'dev-secret-key-csa'
        } as any));
    }

    // Manually register routes
    // Try both absolute and relative paths
    const routesDir = path.resolve(projectRoot, 'src/routes');
    const altRoutesDir = path.resolve(__dirname, 'routes');

    let targetDir = routesDir;
    if (!fs.existsSync(targetDir)) {
        console.warn(`[Vercel] Primary routesDir NOT FOUND: ${targetDir}`);
        targetDir = altRoutesDir;
    }

    if (fs.existsSync(targetDir)) {
        console.log(`[Vercel] Registering routes from: ${targetDir}`);
        try {
            const files = fs.readdirSync(targetDir, { recursive: true });
            console.log(`[Vercel] Route files found: ${JSON.stringify(files)}`);
        } catch (e) {
            console.error(`[Vercel] Failed to list targetDir: ${e}`);
        }

        await registerRoutes(app.server, targetDir, {
            mode: 'production',
            config,
            vite: undefined
        });
    } else {
        console.error(`[Vercel] NO ROUTES DIRECTORY FOUND! Tried: ${routesDir}, ${altRoutesDir}`);
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
        instance.server.server.emit('request', req, res);
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
