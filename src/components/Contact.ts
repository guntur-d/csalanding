import m from 'mithril';
import { toast, Toaster } from '@moriajs/ui';

export const Contact = {
    fullName: '',
    email: '',
    message: '',
    loading: false,

    submit: async function (e: Event) {
        e.preventDefault();
        if (this.loading) return;

        if (!this.fullName || !this.email || !this.message) {
            toast.error('Please fill in all fields');
            return;
        }

        this.loading = true;
        try {
            await m.request({
                method: 'POST',
                url: '/api/inquiry',
                body: {
                    fullName: this.fullName,
                    email: this.email,
                    message: this.message
                }
            });
            toast.success('Thank you! Your message has been sent.');
            this.fullName = '';
            this.email = '';
            this.message = '';
        } catch (err: any) {
            toast.error(err.response?.error || 'Failed to send message. Please try again.');
        } finally {
            this.loading = false;
            m.redraw();
        }
    },

    view: function (vnode: any) {
        const { content } = vnode.attrs;
        return m("section#contact", [
            m(Toaster),
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
                            m("p", { style: "color: var(--text-muted)" }, content.hoursWeekday || "Senin - Sabtu: 09:00 - 17:00"),
                            m("p", { style: "color: var(--text-muted); font-size: 0.9rem;" }, content.hoursWeekend || "Minggu: Dengan Janji Temu")
                        ])
                    ]),
                    m(".contact-form", [
                        m("h3", { style: "margin-bottom: 2rem; font-size: 1.5rem; border-left: 3px solid var(--primary); padding-left: 1rem;" }, "Inquiry Form"),
                        m("form", { onsubmit: (e: any) => this.submit(e) }, [
                            m(".form-group", [
                                m("input[type=text][placeholder='FullName']", {
                                    style: "transition: var(--transition);",
                                    oninput: (e: any) => this.fullName = e.target.value,
                                    value: this.fullName,
                                    disabled: this.loading
                                })
                            ]),
                            m(".form-group", [
                                m("input[type=email][placeholder='Email Address']", {
                                    oninput: (e: any) => this.email = e.target.value,
                                    value: this.email,
                                    disabled: this.loading
                                })
                            ]),
                            m(".form-group", [
                                m("textarea[placeholder='Tell us about your dream home...'][rows=5]", {
                                    oninput: (e: any) => this.message = e.target.value,
                                    value: this.message,
                                    disabled: this.loading
                                })
                            ]),
                            m("button.btn", {
                                type: "submit",
                                style: `width: 100%; letter-spacing: 0.1em; font-size: 0.9rem; opacity: ${this.loading ? 0.5 : 1}; cursor: ${this.loading ? 'not-allowed' : 'pointer'}`
                            }, this.loading ? "SENDING..." : "SEND MESSAGE")
                        ])
                    ])
                ])
            ])
        ]);
    }
};
