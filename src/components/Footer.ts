import m from 'mithril';

export const Footer = {
    view: function () {
        return m("footer", [
            m(".footer-content", { style: "max-width: 1200px; margin: 0 auto;" }, [
                m("h3", { style: "color: var(--primary); font-size: 1.2rem; margin-bottom: 1rem; letter-spacing: 0.2em;" }, "CHANDRA SATRIA AGUNG"),
                m("p", "© 2026 PT Chandra Satria Agung. All Rights Reserved."),
                m("p", { style: "font-size: 0.75rem; color: var(--text-muted); margin-top: 1rem; opacity: 0.6;" }, "Premium Real Estate Development in West Java.")
            ])
        ]);
    }
};
