import 'fastify';
import { createApp } from '@moriajs/core';
import config from '../moria.config.js';

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
