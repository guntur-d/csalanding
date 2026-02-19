import 'fastify';
import { createApp } from '@moriajs/core';
import config from '../moria.config.js';

// Only run standalone if not in a serverless environment
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const app = await createApp({ config });
    await app.listen();
}
