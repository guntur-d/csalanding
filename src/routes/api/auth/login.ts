import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';

export async function POST(request: FastifyRequest, reply: FastifyReply) {
    const { password } = request.body as any;
    const adminHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminHash) {
        request.log.error('ADMIN_PASSWORD_HASH not configured in .env');
        return reply.status(500).send({ error: 'Server configuration error' });
    }

    const inputHash = crypto.createHash('sha256').update(password || '').digest('hex');

    if (inputHash === adminHash) {
        // Simple session cookie (in a real app, use JWT or signed cookies)
        reply.setCookie('admin_session', 'true', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 // 24 hours
        });
        return { success: true };
    }

    return reply.status(401).send({ error: 'Invalid password' });
}
