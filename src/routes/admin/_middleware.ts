import { defineMiddleware } from '@moriajs/core';

export default defineMiddleware(async (request, reply) => {
    const url = request.url;

    // Allow the login page and its API
    if (url.includes('/admin/login') || url.includes('/api/auth/login')) {
        return;
    }

    // Check for admin session cookie
    const session = (request as any).cookies.admin_session;

    if (!session) {
        request.log.info('Unauthorized access to admin area, redirecting to login');
        return reply.redirect('/admin/login');
    }
});
