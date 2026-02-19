import type { FastifyRequest, FastifyReply } from 'fastify';

export async function GET(request: FastifyRequest, reply: FastifyReply) {
    const db = (request.server as any).db;
    try {
        const content = await db.findOne('content', { type: 'landing' });
        request.log.info({ content }, '[API] GET /api/content found:');

        if (!content) {
            request.log.info('[API] No content found, seeding defaults...');
            const defaultContent = {
                type: 'landing',
                hero: {
                    title: "Membangun Masa Depan Anda",
                    subtitle: "Hunian Nyaman, Harga Bersahabat! Lokasi Strategis di Rajapolah, Tasikmalaya.",
                    buttonText: "Lihat Proyek Active"
                },
                about: {
                    title: "About Us",
                    description1: "PT Chandra Satria Agung (CSA) adalah pengembang properti terkemuka...",
                    description2: "Dengan pengalaman bertahun-tahun di industri real estate...",
                    features: [
                        "✓ Lokasi Strategis",
                        "✓ Lingkungan Hijau & Asri",
                        "✓ Akses Mudah ke Fasilitas Publik",
                        "✓ Tanpa Uang Muka (Promo Aktif)"
                    ],
                    image: "FLYER RAJAPOLAH(3)(1).png"
                },
                projects: {
                    sectionTitle: "Active Project: Rajapolah",
                    projectTitle: "Griya Gita Indah Rajapolah",
                    projectDescription: "Hunian Nyaman, Harga Bersahabat!",
                    images: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg", "6.jpg", "7.jpg"],
                    videos: ["n2FyZwVvAX4", "VWRlFTw6QfI", "j2OxFmVgyGo", "9F3Jc5Xe4w8"],
                    specsLeft: ["• Pondasi: Batu Kali", "• Dinding: Bata/Hebel", "• Lantai: Keramik", "• Rangka: Baja Ringan"],
                    specsRight: ["• Atap: Genteng Metal", "• Plafon: Gypsum Board", "• Kusen: Aluminium", "• Sanitasi: Kloset Jongkok"]
                },
                contact: {
                    address: "Jl. Burujul, Desa Rajapolah, Kec. Rajapolah, Kab. Tasikmalaya",
                    contacts: [
                        { name: "Zaki", phone: "08156674422" },
                        { name: "Budi", phone: "081617321732" },
                        { name: "Sari", phone: "08989932000" }
                    ],
                    hoursWeekday: "Senin - Sabtu: 09:00 - 17:00",
                    hoursWeekend: "Minggu: Dengan Janji Temu"
                }
            };
            await db.insertOne('content', defaultContent);
            return defaultContent;
        }

        return content;
    } catch (e) {
        request.log.error(e);
        return reply.status(500).send({ error: "Failed to fetch content" });
    }
}

export async function POST(request: FastifyRequest, reply: FastifyReply) {
    // Only admins should be able to POST, but for now we'll implement the logic
    const db = (request.server as any).db;
    const body = request.body;

    try {
        await db.updateOne('content', { type: 'landing' }, body);
        return { success: true };
    } catch (e) {
        request.log.error(e);
        return reply.status(500).send({ error: "Failed to update content" });
    }
}
