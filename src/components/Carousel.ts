import m from 'mithril';

export const Carousel = {
    oninit: function (vnode: any) {
        vnode.state.currentIndex = 0;

        vnode.state.next = () => {
            const { images } = vnode.attrs;
            vnode.state.currentIndex = (vnode.state.currentIndex + 1) % images.length;
        };

        vnode.state.prev = () => {
            const { images } = vnode.attrs;
            vnode.state.currentIndex = (vnode.state.currentIndex - 1 + images.length) % images.length;
        };

        vnode.state.goTo = (index: number) => {
            vnode.state.currentIndex = index;
        };
    },
    view: function (vnode: any) {
        const { images } = vnode.attrs;
        const currentIdx = vnode.state.currentIndex;

        if (!images || images.length === 0) {
            return null;
        }

        return m(".carousel-container", [
            // Track containing all slides
            m(".carousel-track", {
                style: `transform: translateX(-${currentIdx * 100}%)`
            }, images.map((img: string, idx: number) =>
                m(".carousel-slide", [
                    m(".slide-img", { style: `background-image: url('${img}')` })
                ])
            )),

            // Navigation Arrows (only show if more than 1 image)
            images.length > 1 ? [
                m("button.carousel-nav-btn.prev", {
                    onclick: (e: any) => {
                        e.stopPropagation();
                        vnode.state.prev();
                    }
                }, "❮"),
                m("button.carousel-nav-btn.next", {
                    onclick: (e: any) => {
                        e.stopPropagation();
                        vnode.state.next();
                    }
                }, "❯")
            ] : null,

            // Indicator Dots
            images.length > 1 ? m(".carousel-indicators", images.map((_: any, idx: number) =>
                m("button.carousel-dot", {
                    class: idx === currentIdx ? 'active' : '',
                    onclick: (e: any) => {
                        e.stopPropagation();
                        vnode.state.goTo(idx);
                    }
                })
            )) : null
        ]);
    }
};
