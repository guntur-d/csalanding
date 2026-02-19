import type { FastifyRequest, FastifyReply } from 'fastify';

export async function POST(request: FastifyRequest, reply: FastifyReply) {
    const db = (request.server as any).db;
    const { fullName, email, message } = request.body as any;

    if (!fullName || !email || !message) {
        return reply.status(400).send({ error: "Missing required fields" });
    }

    try {
        await db.insertOne('inquiries', {
            fullName,
            email,
            message,
            createdAt: new Date().toISOString()
        });
        return { success: true };
    } catch (e) {
        request.log.error(e);
        return reply.status(500).send({ error: "Failed to save inquiry" });
    }
}

export async function GET(request: FastifyRequest, reply: FastifyReply) {
    // Basic auth check would be good here, but for now we'll assume admin access
    // if called from the admin dashboard (which should have its own middleware)
    const db = (request.server as any).db;
    try {
        const inquiries = await db.findMany('inquiries', {});
        // Sort by date descending
        return inquiries.sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    } catch (e) {
        request.log.error(e);
        return reply.status(500).send({ error: "Failed to fetch inquiries" });
    }
}
