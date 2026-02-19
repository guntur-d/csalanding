import m from 'mithril';

export const Contact = {
    view: function (vnode: any) {
        const { content } = vnode.attrs;
        return m("section#contact", [
            m(".container", { style: "max-width: 1200px; margin: 0 auto;" }, [
                m("h2.section-title", "Connect With Us"),
                m(".contact-container", [
                    m(".contact-info", [
                        m("div", [
                            m("h4", "Strategic Location"),
                            m("p", { style: "color: var(--text-muted)" }, content.address || "Jl. Burujul, Desa Rajapolah, Kec. Rajapolah, Kab. Tasikmalaya")
                        ]),
                        m("div", { style: "margin-top: 2.5rem" }, [
                            m("h4", "Direct Contact"),
                            (content.contacts || [
                                { name: "Zaki", phone: "08156674422" },
                                { name: "Budi", phone: "081617321732" },
                                { name: "Sari", phone: "08989932000" }
                            ]).map((c: any) => m("p", { style: "margin-bottom: 0.5rem" }, [
                                m("span", { style: "color: var(--text-muted); width: 60px; display: inline-block;" }, `${c.name}: `),
                                m("a", {
                                    href: `tel:${c.phone}`,
                                    style: "color: var(--primary); font-weight: 600; text-decoration: none;"
                                }, c.phone)
                            ]))
                        ]),
                        m("div", { style: "margin-top: 2.5rem" }, [
                            m("h4", "Visit Hours"),
                            m("p", { style: "color: var(--text-muted)" }, content.hoursWeekday || "Monday - Saturday: 09:00 - 17:00"),
                            m("p", { style: "color: var(--text-muted); font-size: 0.9rem;" }, content.hoursWeekend || "Sunday: By Appointment")
                        ])
                    ]),
                    m(".contact-form", [
                        m("h3", { style: "margin-bottom: 2rem; font-size: 1.5rem; border-left: 3px solid var(--primary); padding-left: 1rem;" }, "Inquiry Form"),
                        m(".form-group", [
                            m("input[type=text][placeholder='FullName']", { style: "transition: var(--transition);" })
                        ]),
                        m(".form-group", [
                            m("input[type=email][placeholder='Email Address']")
                        ]),
                        m(".form-group", [
                            m("textarea[placeholder='Tell us about your dream home...'][rows=5]")
                        ]),
                        m("button.btn", { style: "width: 100%; letter-spacing: 0.1em; font-size: 0.9rem;" }, "SEND MESSAGE")
                    ])
                ])
            ])
        ]);
    }
};
