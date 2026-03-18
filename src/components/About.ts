import m from 'mithril';

export const About = {
    view: function (vnode: any) {
        const { content } = vnode.attrs;
        return m("section#about", [
            m(".container", { style: "max-width: 1200px; margin: 0 auto;" }, [
                m("h2.section-title", content.title || "Quality Living, Trusted Future"),
                m(".about-grid", [
                    m(".about-text", [
                        (content.description1 || "PT Chandra Satria Agung (CSA) adalah pengembang properti terkemuka yang berdedikasi untuk menciptakan hunian berkualitas dengan harga yang kompetitif.")
                            .split('\n')
                            .filter((p: string) => p.trim() !== '')
                            .map((para: string, idx: number) => m("p", { style: idx > 0 ? "margin-top: 1rem;" : "" }, para)),
                        (content.description2 || "Dengan pengalaman bertahun-tahun di industri real estate, kami terus berinovasi dalam desain dan spesifikasi bangunan untuk memberikan nilai terbaik bagi konsumen kami.")
                            .split('\n')
                            .filter((p: string) => p.trim() !== '')
                            .map((para: string, idx: number) => m("p", { style: idx === 0 ? "margin-top: 1.5rem; color: var(--text-muted); font-size: 0.95rem;" : "margin-top: 1rem; color: var(--text-muted); font-size: 0.95rem;" }, para)),
                        m("ul", { style: "margin-top: 2rem; list-style: none;" }, (content.features || [
                            "✓ Lokasi Strategis di Pusat Pertumbuhan",
                            "✓ Lingkungan Hijau, Asri & Nyaman",
                            "✓ Akses 5 Menit ke Fasilitas Publik",
                            "✓ Promo Spesial: DP 0% & Akad Cepat"
                        ]).map((f: string) => m("li", { style: "margin-bottom: 0.8rem; color: var(--primary); font-weight: 600;" }, f)))
                    ]),
                    m(".about-img", { style: "position: relative;" }, [
                        m("img", {
                            src: content.image || "FLYER RAJAPOLAH(3)(1).png",
                            alt: "CSA Company Profile",
                            style: "width: 100%; border-radius: 20px; box-shadow: 0 30px 60px rgba(0,0,0,0.5); position: relative; z-index: 2;"
                        }),
                        m(".img-backdrop", { style: "position: absolute; top: 20px; left: 20px; width: 100%; height: 100%; border: 2px solid var(--primary); border-radius: 20px; z-index: 1;" })
                    ])
                ])
            ])
        ]);
    }
};
