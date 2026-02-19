import 'fastify';
import { createApp, registerRoutes } from '@moriajs/core';
import config from '../moria.config.js';
import path from 'node:path';
import fs from 'node:fs';

let app: any;

/**
 * Initialize the MoriaJS application.
 */
export async function initApp() {
    if (app) return app;
    app = await createApp({
        config: {
            ...config,
            mode: 'production',
            rootDir: process.cwd(),
        },
        fastifyOptions: {
            logger: {
                level: 'info'
            }
        }
    });

    // Manually register routes (deferred in listen() by default)
    const routesDir = path.resolve(process.cwd(), config.routes?.dir ?? 'src/routes');
    if (fs.existsSync(routesDir)) {
        console.log(`[Vercel] Registering routes from: ${routesDir}`);
        await registerRoutes(app.server, routesDir, {
            mode: 'production',
            config,
            vite: undefined
        });
    } else {
        console.warn(`[Vercel] Routes directory NOT FOUND: ${routesDir}`);
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
