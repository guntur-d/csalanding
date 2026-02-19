import 'fastify';
import { createApp, registerRoutes } from '@moriajs/core';
import config from '../moria.config.js';
import path from 'node:path';
import fs from 'node:fs';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let app: any;

/**
 * Initialize the MoriaJS application.
 */
export async function initApp() {
    if (app) return app;

    console.log(`[Vercel] Project Root: ${projectRoot}`);
    console.log(`[Vercel] CWD: ${process.cwd()}`);

    app = await createApp({
        config: {
            ...config,
            mode: 'production',
            rootDir: projectRoot,
        },
        fastifyOptions: {
            logger: {
                level: 'info'
            }
        }
    });

    // Manually register routes (deferred in listen() by default)
    const routesDir = path.resolve(projectRoot, config.routes?.dir ?? 'src/routes');
    if (fs.existsSync(routesDir)) {
        console.log(`[Vercel] Registering routes from: ${routesDir}`);
        try {
            const files = fs.readdirSync(routesDir, { recursive: true });
            console.log(`[Vercel] Route files found: ${JSON.stringify(files)}`);
        } catch (e) {
            console.error(`[Vercel] Failed to list routesDir: ${e}`);
        }

        await registerRoutes(app.server, routesDir, {
            mode: 'production',
            config,
            vite: undefined
        });
    } else {
        console.warn(`[Vercel] Routes directory NOT FOUND: ${routesDir}`);
        try {
            const parent = path.dirname(routesDir);
            console.log(`[Vercel] Parent dir (${parent}) contents: ${JSON.stringify(fs.readdirSync(parent))}`);
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
        instance.server.server.emit('request', req, res);
    } catch (e: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            error: "MoriaJS Initialization Failed",
            message: e.message
        }));
    }
};
