const App = {
    view: function () {
        return [
            m(Navigation),
            m(Hero),
            m(About),
            m(Projects),
            m(Contact),
            m(Footer)
        ];
    }
};

const Navigation = {
    view: function () {
        return m("nav", [
            m(".logo", "Chandra Satria Agung"),
            m(".nav-links", [
                m("a[href=#about]", "About"),
                m("a[href=#projects]", "Projects"),
                m("a[href=#contact]", "Contact")
            ])
        ]);
    }
};

const Hero = {
    view: function () {
        return m("section.hero", [
            m("h1", "Membangun Masa Depan Anda"),
            m("p", "Hunian Nyaman, Harga Bersahabat! Lokasi Strategis di Rajapolah, Tasikmalaya."),
            m("button.btn", {
                onclick: () => document.getElementById('projects').scrollIntoView({ behavior: 'smooth' })
            }, "Lihat Proyek Active")
        ]);
    }
};

const About = {
    view: function () {
        return m("section#about", [
            m("h2.section-title", "About Us"),
            m(".about-grid", [
                m(".about-text", [
                    m("p", "PT Chandra Satria Agung (CSA) adalah pengembang properti terkemuka yang berdedikasi untuk menciptakan hunian berkualitas dengan harga yang kompetitif. Kami percaya bahwa setiap keluarga layak mendapatkan rumah yang nyaman, aman, dan asri."),
                    m("p", { style: "margin-top: 1rem" }, "Dengan pengalaman bertahun-tahun di industri real estate, kami terus berinovasi dalam desain dan spesifikasi bangunan untuk memberikan nilai terbaik bagi konsumen kami. Fokus utama kami saat ini adalah pengembangan di area Rajapolah, Tasikmalaya."),
                    m("ul", { style: "margin-top: 1.5rem; list-style: none;" }, [
                        m("li", "✓ Lokasi Strategis"),
                        m("li", "✓ Lingkungan Hijau & Asri"),
                        m("li", "✓ Akses Mudah ke Fasilitas Publik"),
                        m("li", "✓ Tanpa Uang Muka (Promo Aktif)")
                    ])
                ]),
                m(".about-img", [
                    m("img", { src: "FLYER RAJAPOLAH(3)(1).png", alt: "CSA Company Profile" })
                ])
            ])
        ]);
    }
};

const Projects = {
    view: function () {
        const images = ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg", "6.jpg", "7.jpg"];
        const videos = [
            "n2FyZwVvAX4",
            "VWRlFTw6QfI",
            "j2OxFmVgyGo",
            "9F3Jc5Xe4w8"
        ];

        return m("section#projects", [
            m("h2.section-title", "Active Project: Rajapolah"),
            m(".project-details", [
                m("h3", { style: "color: var(--primary); margin-bottom: 1rem" }, "Griya Gita Indah Rajapolah"),
                m("p", "Hunian Nyaman, Harga Bersahabat! Terletak strategis dengan dikelilingi fasilitas lengkap seperti sekolah (SMP, SMK 1 Rajapolah), Pasar Rajapolah, dan Terminal Rajapolah."),

                m("h4", { style: "margin: 2rem 0 1rem; color: var(--primary)" }, "Spesifikasi Bangunan Berkualitas:"),
                m(".projects-grid", [
                    m(".project-card", [
                        m(".card-content", [
                            m("ul", { style: "list-style: none" }, [
                                m("li", "• Pondasi: Batu Kali"),
                                m("li", "• Dinding: Bata/Hebel"),
                                m("li", "• Lantai: Keramik"),
                                m("li", "• Rangka: Baja Ringan")
                            ])
                        ])
                    ]),
                    m(".project-card", [
                        m(".card-content", [
                            m("ul", { style: "list-style: none" }, [
                                m("li", "• Atap: Genteng Metal"),
                                m("li", "• Plafon: Gypsum Board"),
                                m("li", "• Kusen: Aluminium"),
                                m("li", "• Sanitasi: Kloset Jongkok")
                            ])
                        ])
                    ])
                ]),

                m("h4", { style: "margin: 3rem 0 1.5rem; color: var(--primary)" }, "Galeri Foto:"),
                m(".projects-grid", images.map(img =>
                    m(".project-card", [
                        m(".card-img", { style: `background-image: url('${img}')` })
                    ])
                )),

                m("h4", { style: "margin: 3rem 0 1.5rem; color: var(--primary)" }, "Video Showcase:"),
                m(".video-grid", videos.map(id =>
                    m(".video-container", [
                        m("iframe", {
                            src: `https://www.youtube.com/embed/${id}`,
                            frameborder: "0",
                            allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                            allowfullscreen: true
                        })
                    ])
                ))
            ])
        ]);
    }
};

const Contact = {
    view: function () {
        return m("section#contact", [
            m("h2.section-title", "Contact Us"),
            m(".contact-container", [
                m(".contact-info", [
                    m("div", [
                        m("h4", "Alamat Kantor"),
                        m("p", "Jl. Burujul, Desa Rajapolah, Kec. Rajapolah, Kab. Tasikmalaya")
                    ]),
                    m("div", [
                        m("h4", "Hubungi Kami"),
                        m("p", [
                            "Zaki: ",
                            m("a[href=tel:08156674422]", { style: "color: var(--text-muted)" }, "081-5667-4422")
                        ]),
                        m("p", [
                            "Budi: ",
                            m("a[href=tel:081617321732]", { style: "color: var(--text-muted)" }, "0816-1732-1732")
                        ]),
                        m("p", [
                            "Sari: ",
                            m("a[href=tel:08989932000]", { style: "color: var(--text-muted)" }, "089-8993-2000")
                        ])
                    ]),
                    m("div", [
                        m("h4", "Jam Operasional"),
                        m("p", "Senin - Sabtu: 09:00 - 17:00"),
                        m("p", "Minggu: Dengan Janji Temu")
                    ])
                ]),
                m(".contact-form", [
                    m(".form-group", [
                        m("input[type=text][placeholder='Nama Lengkap']")
                    ]),
                    m(".form-group", [
                        m("input[type=email][placeholder='Email']")
                    ]),
                    m(".form-group", [
                        m("textarea[placeholder='Pesan atau Pertanyaan'][rows=5]")
                    ]),
                    m("button.btn", { style: "width: 100%" }, "Kirim Pesan")
                ])
            ])
        ]);
    }
};

const Footer = {
    view: function () {
        return m("footer", [
            m("p", "© 2026 PT Chandra Satria Agung. All Rights Reserved."),
            m("p", { style: "font-size: 0.8rem; margin-top: 0.5rem" }, "Designed for Excellence in Housing.")
        ]);
    }
};

m.mount(document.getElementById("app"), App);
