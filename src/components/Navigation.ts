import m from 'mithril';

export const Navigation = {
    oninit: function (vnode: any) {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme') || 'dark';
            vnode.state.theme = savedTheme;
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            vnode.state.theme = 'dark';
        }
    },
    toggleTheme: function (vnode: any) {
        const newTheme = vnode.state.theme === 'dark' ? 'light' : 'dark';
        vnode.state.theme = newTheme;
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    },
    view: function (vnode: any) {
        const isDark = vnode.state.theme === 'dark';

        return m("nav", [
            m(".nav-container", { style: "width: 100%; max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;" }, [
                m(".logo", "Chandra Satria Agung"),
                m(".nav-links", { style: "display: flex; align-items: center; gap: 2rem;" }, [
                    m("a[href=#about]", "About"),
                    m("a[href=#projects]", "Projects"),
                    m("a[href=#contact]", "Contact"),
                    m("button.theme-toggle", {
                        onclick: () => this.toggleTheme(vnode),
                        style: "background: none; border: 1px solid var(--primary); color: var(--primary); padding: 0.5rem; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: var(--transition);"
                    }, isDark ? "☀️" : "🌙")
                ])
            ])
        ]);
    }
};
