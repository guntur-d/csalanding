import { ObjectId } from 'mongodb';
import type { FastifyRequest, FastifyReply } from 'fastify';

export async function GET(request: FastifyRequest, reply: FastifyReply) {
    const db = (request.server as any).db;
    if (!db) {
        return reply.status(500).send({ error: "Database not initialized" });
    }

    const { id } = request.params as any;

    try {
        let filter: any = { id };

        // MongoDB stores _id as ObjectId by default. 
        // Our adapter maps 'id' to '_id', but doesn't cast to ObjectId.
        if (id && /^[0-9a-fA-F]{24}$/.test(id)) {
            filter = { id: new ObjectId(id) };
        }

        const media = await db.findOne('media', filter);

        if (!media || !media.data) {
            return reply.status(404).send({ error: "Media not found" });
        }

        reply.type(media.contentType || 'image/jpeg');

        // MongoDB Binary data in Node.js has a .buffer property
        return media.data.buffer || media.data;
    } catch (e) {
        request.log.error(e);
        return reply.status(500).send({ error: "Failed to fetch media" });
    }
}
