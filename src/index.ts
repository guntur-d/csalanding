import { createApp } from '@moriajs/core';
import { createDatabasePlugin } from '@moriajs/db';
import { createAuthPlugin } from '@moriajs/auth';
import config from '../moria.config.js';

const app = await createApp({ config });

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

await app.listen();
