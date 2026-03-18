import { MongoClient } from 'mongodb';
import 'dotenv/config';

async function main() {
    const client = new MongoClient(process.env.MONGODB_URI_CUSTOM || 'mongodb://localhost:27017/csa');
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME || 'csa');
        const content = await db.collection('content').findOne({ type: 'landing' });
        console.log('--- Current Landing Page Content ---');
        console.log(JSON.stringify(content, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main();
