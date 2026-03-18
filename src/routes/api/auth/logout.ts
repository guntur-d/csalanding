import type { FastifyRequest, FastifyReply } from 'fastify';

export async function POST(request: FastifyRequest, reply: FastifyReply) {
    console.log('[API] Logout triggered. Clearing admin_session cookie.');

    // Clear the session cookie
    reply.setCookie('admin_session', '', {
        path: '/',
        expires: new Date(0),
        maxAge: -1,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });

    console.log('[API] Logout cookie cleared. Returning success.');
    return { success: true };
}
