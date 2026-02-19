import m from 'mithril';

export const Hero = {
    view: function (vnode: any) {
        const { content } = vnode.attrs;
        return m("section.hero", [
            m(".hero-overlay", { style: "position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: var(--hero-overlay); z-index: 1;" }),
            m(".hero-content", { style: "position: relative; z-index: 2; max-width: 800px;" }, [
                m("h1", content.title || "Membangun Masa Depan Anda"),
                m("p", content.subtitle || "Hunian Nyaman, Harga Bersahabat! Lokasi Strategis di Rajapolah, Tasikmalaya."),
                m("button.btn", {
                    onclick: () => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
                }, content.buttonText || "Pelajari Selengkapnya")
            ])
        ]);
    }
};
