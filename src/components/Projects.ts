import m from 'mithril';

export const Projects = {
    view: function (vnode: any) {
        const { content } = vnode.attrs;
        const projectsList = content.list || [content]; // Fallback to content itself if list is missing

        const getYoutubeId = (url: string) => {
            if (!url) return '';
            const match = url.match(/(?:\?v=|\/embed\/|\/1\/|\/v\/|https:\/\/youtu\.be\/|\/7\/|watch\?v=|^)([a-zA-Z0-9_-]{11})(?:\?|&|$|\s)/);
            return match ? match[1] : '';
        };

        return m("section#projects", [
            m("h2.section-title", content.sectionTitle || "Our Projects"),
            m(".projects-wrapper", projectsList.map((project: any, index: number) => {
                const images = project.images || ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg", "6.jpg", "7.jpg"];
                const videos = project.videos || ["9F3Jc5Xe4w8"];

                return m(".project-details", {
                    style: index > 0 ? "margin-top: 5rem; border-top: 1px solid var(--glass); padding-top: 3rem" : ""
                }, [
                    m("h3", { style: "color: var(--primary); margin-bottom: 1rem" }, project.projectTitle || "Active Project"),
                    m("p", project.projectDescription || "Detail Proyek Chandra Satria Agung"),

                    m("h4", { style: "margin: 2rem 0 1rem; color: var(--primary)" }, "Spesifikasi Bangunan:"),
                    m(".projects-grid", [
                        m(".project-card", [
                            m(".card-content", [
                                m("ul", { style: "list-style: none" }, (project.specsLeft || [
                                    "• Pondasi: Batu Kali",
                                    "• Dinding: Bata/Hebel",
                                    "• Lantai: Keramik",
                                    "• Rangka: Baja Ringan"
                                ]).map((s: string) => m("li", s)))
                            ])
                        ]),
                        m(".project-card", [
                            m(".card-content", [
                                m("ul", { style: "list-style: none" }, (project.specsRight || [
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
                        ])
                    }))
                ]);
            }))
        ]);
    }
};
