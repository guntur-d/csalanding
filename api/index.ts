import 'fastify';
import { createApp } from '@moriajs/core';
import { createDatabasePlugin } from '@moriajs/db';
import { createAuthPlugin } from '@moriajs/auth';
import config from '../moria.config.js';

let app: any;

async function initApp() {
    if (app) return app;

    console.log('[Vercel] Initializing MoriaJS App...');
    try {
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

        // Register Database
        if (config.database) {
            console.log('[Vercel] Registering Database...');
            await app.use(createDatabasePlugin(config.database as any));
        }

        // Register Auth
        if (config.auth) {
            console.log('[Vercel] Registering Auth...');
            await app.use(createAuthPlugin({
                ...config.auth,
                secret: config.auth.secret || 'dev-secret-key-csa'
            } as any));
        }

        await app.server.ready();
        console.log('[Vercel] App Initialization Complete');
        return app;
    } catch (error: any) {
        console.error('[Vercel] CRITICAL INITIALIZATION ERROR:', error);
        throw error;
    }
}

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
            stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
        }));
    }
};
