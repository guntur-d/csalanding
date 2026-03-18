import { Binary } from 'mongodb';
import type { FastifyRequest, FastifyReply } from 'fastify';

export async function POST(request: FastifyRequest, reply: FastifyReply) {
    const db = (request.server as any).db;
    if (!db) {
        return reply.status(500).send({ error: "Database not initialized" });
    }

    const { filename, contentType, data } = request.body as any; // data is base64 string

    if (!data || !contentType) {
        return reply.status(400).send({ error: "Missing data or contentType" });
    }

    try {
        const buffer = Buffer.from(data, 'base64');
        const binaryData = new Binary(buffer);

        const result = await db.insertOne('media', {
            filename: filename || 'upload',
            contentType,
            data: binaryData,
            createdAt: new Date().toISOString()
        });

        return {
            success: true,
            id: result.id,
            url: `/api/media/${result.id}`
        };
    } catch (e) {
        request.log.error(e);
        return reply.status(500).send({ error: "Failed to upload media" });
    }
}
