import m from 'mithril';

export const Projects = {
    view: function (vnode: any) {
        const { content } = vnode.attrs;
        const images = content.images || ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg", "6.jpg", "7.jpg"];
        const videos = content.videos || [
            "TXMGu2d8c8g", // Mithril.js Tutorial (Known working public video)
            "9F3Jc5Xe4w8", // Original video (potentially restricted)
        ];

        const getYoutubeId = (url: string) => {
            if (!url) return '';
            const match = url.match(/(?:\?v=|\/embed\/|\/1\/|\/v\/|https:\/\/youtu\.be\/|\/7\/|watch\?v=|^)([a-zA-Z0-9_-]{11})(?:\?|&|$|\s)/);
            return match ? match[1] : '';
        };

        return m("section#projects", [
            m("h2.section-title", content.sectionTitle || "Active Project: Rajapolah"),
            m(".project-details", [
                m("h3", { style: "color: var(--primary); margin-bottom: 1rem" }, content.projectTitle || "Griya Gita Indah Rajapolah"),
                m("p", content.projectDescription || "Hunian Nyaman, Harga Bersahabat! Terletak strategis dengan dikelilingi fasilitas lengkap seperti sekolah (SMP, SMK 1 Rajapolah), Pasar Rajapolah, dan Terminal Rajapolah."),

                m("h4", { style: "margin: 2rem 0 1rem; color: var(--primary)" }, "Spesifikasi Bangunan Berkualitas:"),
                m(".projects-grid", [
                    m(".project-card", [
                        m(".card-content", [
                            m("ul", { style: "list-style: none" }, (content.specsLeft || [
                                "• Pondasi: Batu Kali",
                                "• Dinding: Bata/Hebel",
                                "• Lantai: Keramik",
                                "• Rangka: Baja Ringan"
                            ]).map((s: string) => m("li", s)))
                        ])
                    ]),
                    m(".project-card", [
                        m(".card-content", [
                            m("ul", { style: "list-style: none" }, (content.specsRight || [
                                "• Atap: Genteng Metal",
                                "• Plafon: Gypsum Board",
                                "• Kusen: Aluminium",
                                "• Sanitasi: Kloset Jongkok"
                            ]).map((s: string) => m("li", s)))
                        ])
                    ])
                ]),

                m("h4", { style: "margin: 3rem 0 1.5rem; color: var(--primary)" }, "Galeri Foto:"),
                m(".projects-grid", images.map((img: string) =>
                    m(".project-card", [
                        m(".card-img", { style: `background-image: url('${img}')` })
                    ])
                )),

                m("h4", { style: "margin: 3rem 0 1.5rem; color: var(--primary)" }, "Video Showcase:"),
                m(".video-grid", videos.map((urlOrId: string) => {
                    const id = getYoutubeId(urlOrId);
                    if (!id) return null;
                    return m(".video-container", { key: id }, [
                        m.trust(`<iframe src="https://www.youtube.com/embed/${id}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`)
                    ]);
                }))
            ])
        ]);
    }
};
