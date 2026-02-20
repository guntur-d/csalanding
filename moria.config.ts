import { defineConfig } from '@moriajs/core';
import 'dotenv/config';

export default defineConfig({
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    server: {
        port: 3000,
        host: '0.0.0.0',
    },
    database: {
        adapter: 'mongo',
        url: process.env.MONGODB_URI_CUSTOM || 'mongodb://localhost:27017/csa',
        dbName: process.env.DB_NAME || 'csa',
    },
    auth: {
        secret: process.env.JWT_SECRET || 'dev-secret-key-csa',
        expiresIn: '7d',
        cookieName: 'csa_auth',
    },
    vite: {
        clientEntry: '/src/entry-client.ts',
    }
});
