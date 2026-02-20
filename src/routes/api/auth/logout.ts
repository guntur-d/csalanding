import type { FastifyRequest, FastifyReply } from 'fastify';

export async function POST(request: FastifyRequest, reply: FastifyReply) {
    // Aggressively clear everything
    reply.header('Clear-Site-Data', '"cookies", "storage", "cache"');

    reply.setCookie('admin_session', '', {
        path: '/',
        expires: new Date(0),
        maxAge: -1,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });

    return { success: true };
}
