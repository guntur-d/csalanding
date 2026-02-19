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
 * Recursive directory listing for debugging
 */
function listFiles(dir: string, depth = 0): string[] {
    if (depth > 2) return [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        let results: string[] = [];
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(`DIR: ${fullPath}`);
                results = results.concat(listFiles(fullPath, depth + 1));
            } else {
                results.push(`FILE: ${fullPath}`);
            }
        }
        return results;
    } catch (e) {
        return [`ERROR listing ${dir}: ${e}`];
    }
}

/**
 * Initialize the MoriaJS application.
 */
export async function initApp() {
    if (app) return app;

    console.log(`[Vercel] __dirname: ${__dirname}`);
    console.log(`[Vercel] projectRoot (cwd): ${projectRoot}`);

    // Diagnostic Scan
    console.log('[Vercel] FS Scan:', JSON.stringify(listFiles(projectRoot).slice(0, 100)));

    app = await createApp({
        config: {
            ...config,
            // Omit database and auth from config to prevent auto-registration crash
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

    // Add immediate debug route
    app.server.get('/vercel-debug', async () => ({
        status: 'UP',
        cwd: process.cwd(),
        dirname: __dirname,
        projectRoot,
        scan: listFiles(projectRoot).slice(0, 200)
    }));

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
    // Try multiple possible locations for routes in Vercel bundle
    const possibleRoutesDirs = [
        path.resolve(projectRoot, 'src/routes'),
        path.resolve(projectRoot, 'routes'),
        path.resolve(__dirname, 'routes'),
        path.resolve(__dirname, '../src/routes')
    ];

    let targetDir = '';
    for (const dir of possibleRoutesDirs) {
        if (fs.existsSync(dir)) {
            targetDir = dir;
            break;
        }
    }

    if (targetDir) {
        console.log(`[Vercel] Registering routes from: ${targetDir}`);
        try {
            await registerRoutes(app.server, targetDir, {
                mode: 'production',
                config,
                vite: undefined
            });
            console.log('[Vercel] Routes registered successfully');
        } catch (e) {
            console.error('[Vercel] registerRoutes Failed:', e);
        }
    } else {
        console.error(`[Vercel] NO ROUTES DIRECTORY FOUND! Tried: ${JSON.stringify(possibleRoutesDirs)}`);
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
        // REMOVED nextTick - it causes Vercel to terminate before Fastify can respond
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
