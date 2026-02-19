import 'fastify';
import { createApp } from '@moriajs/core';
import { createDatabasePlugin } from '@moriajs/db';
import { createAuthPlugin } from '@moriajs/auth';
import config from '../moria.config.js';

// Initialize the app once
const app = await createApp({
    config: {
        ...config,
        mode: 'production',
        rootDir: process.cwd()
    }
});

// Register Database
if (config.database) {
    await app.use(createDatabasePlugin(config.database as any));
}

// Register Auth
if (config.auth) {
    await app.use(createAuthPlugin({
        ...config.auth,
        secret: config.auth.secret || 'dev-secret-key-csa'
    } as any));
}

export default async (req: any, res: any) => {
    await app.server.ready();
    app.server.server.emit('request', req, res);
};
