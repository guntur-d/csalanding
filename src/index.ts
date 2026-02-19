import 'fastify';
import { createApp } from '@moriajs/core';
import { createDatabasePlugin } from '@moriajs/db';
import { createAuthPlugin } from '@moriajs/auth';
import config from '../moria.config.js';

const app = await createApp({ config });

await app.listen();

await app.listen();
