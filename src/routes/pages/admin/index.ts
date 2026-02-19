import m from 'mithril';
import { toast, Toaster } from '@moriajs/ui';

export async function getServerData(request: any) {
    const db = (request.server as any).db;
    if (!db) {
        request.log.warn('[CMS] Database not initialized during SSR');
        return { content: {} };
    }
    try {
        const content = await db.findOne('content', { type: 'landing' });
        request.log.info({ content }, '[CMS] getServerData found:');
        return { content: content || {} };
    } catch (e) {
        request.log.error(e);
        return { content: {} };
    }
}

export default {
    oninit: function (vnode: any) {
        const { serverData } = vnode.attrs;
        if (typeof window !== 'undefined') {
            console.log('[CMS] Hydrating admin page with serverData:', serverData);
        }
        vnode.state.content = serverData?.content || {};

        // Ensure nested objects exist (non-mutating)
        const ensure = (obj: any) => {
            const out = { ...obj };
            if (!out.hero) out.hero = {};
            if (!out.about) out.about = {};
            if (!out.projects) out.projects = {};
            if (!out.contact) out.contact = {};
            return out;
        };

        const rawContent = serverData?.content;
        // True loading if NO data OR if it's the empty "ensured" shell from a previous SSR attempt
        vnode.state.loading = !rawContent || Object.keys(rawContent).length === 0 || !rawContent.hero?.title;
        vnode.state.content = ensure(rawContent || {});

        if (typeof window !== 'undefined') {
            console.log('[CMS] oninit: loading=', vnode.state.loading, 'rawContentKeys=', rawContent ? Object.keys(rawContent).length : 0);
        }

        if (typeof window !== 'undefined' && vnode.state.loading) {
            console.log('[CMS] Fetching catch-up data via /api/content...');
            m.request({
                method: "GET",
                url: "/api/content"
            }).then((response: any) => {
                console.log('[CMS] Fetch success:', response);
                vnode.state.content = ensure(response || {});
                vnode.state.loading = false;
            }).catch((e: any) => {
                console.error('[CMS] Fetch error:', e);
                toast.error("Failed to load content");
                vnode.state.loading = false;
            });
        }
    },

    save: async function (vnode: any) {
        vnode.state.saving = true;
        try {
            await m.request({
                method: "POST",
                url: "/api/content",
                body: vnode.state.content
            });
            toast.success("Changes saved live!");
        } catch (e) {
            toast.error("Failed to save changes");
        } finally {
            vnode.state.saving = false;
            m.redraw();
        }
    },

    logout: async function () {
        // Clear cookie by calling a logout API or just expiry
        document.cookie = "admin_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = '/admin/login';
    },

    view: function (vnode: any) {
        const { content, loading, saving } = vnode.state;

        if (loading) {
            return m(".admin-loading", {
                style: "color: #fff; padding: 2rem; background: #111; min-height: 100vh;"
            }, "Initializing CMS...");
        }

        // Log once per significant state
        if (typeof window !== 'undefined' && !vnode.state.viewLogged) {
            console.log('[CMS] Rendering admin view with content:', content);
            vnode.state.viewLogged = true;
        }

        return m(".admin-layout", {
            style: "background: var(--admin-bg); min-height: 100vh; padding: 2rem; color: var(--text-main); font-family: 'Outfit', sans-serif; transition: var(--transition);"
        }, [
            m(Toaster),
            m("header", { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; border-bottom: 1px solid #333; padding-bottom: 1.5rem;" }, [
                m("div", [
                    m("h1", { style: "color: #c5a059; margin: 0; font-size: 1.8rem;" }, "CSA CMS Admin"),
                    m("p", { style: "color: #888; margin: 0.5rem 0 0; font-size: 0.9rem;" }, "Manage your website content live")
                ]),
                m(".admin-actions", [
                    m("button", {
                        onclick: () => this.logout(),
                        style: "margin-right: 1rem; padding: 0.75rem 1.5rem; background: transparent; border: 1px solid #444; color: #888; border-radius: 8px; cursor: pointer; transition: 0.3s;"
                    }, "Logout"),
                    m("button", {
                        onclick: () => this.save(vnode),
                        disabled: saving,
                        style: `padding: 0.75rem 2.5rem; background: #c5a059; color: #111; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s; opacity: ${saving ? 0.5 : 1}`
                    }, saving ? "SAVING..." : "SAVE CHANGES")
                ])
            ]),

            m(".admin-grid", { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 2.5rem;" }, [
                // Hero Section
                m(".admin-card", { style: "background: #1a1a1a; padding: 2rem; border-radius: 15px; border: 1px solid #333;" }, [
                    m("h2", { style: "color: #c5a059; margin-bottom: 2rem; border-bottom: 1px solid #333; padding-bottom: 1rem;" }, "Hero Section"),
                    m(".form-group", [
                        m("label", { style: "display: block; color: #aaa; margin-bottom: 0.5rem;" }, "Main Title"),
                        m("input", {
                            style: "width: 100%; padding: 1rem; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px; margin-bottom: 1.5rem;",
                            value: content.hero?.title || '',
                            oninput: (e: any) => content.hero.title = e.target.value
                        }),
                        m("label", { style: "display: block; color: #aaa; margin-bottom: 0.5rem;" }, "Subtitle"),
                        m("textarea", {
                            style: "width: 100%; padding: 1rem; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px; margin-bottom: 1.5rem;",
                            rows: 3,
                            value: content.hero?.subtitle || '',
                            oninput: (e: any) => content.hero.subtitle = e.target.value
                        }),
                        m("label", { style: "display: block; color: #aaa; margin-bottom: 0.5rem;" }, "Button Text"),
                        m("input", {
                            style: "width: 100%; padding: 1rem; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px;",
                            value: content.hero?.buttonText || '',
                            oninput: (e: any) => content.hero.buttonText = e.target.value
                        })
                    ])
                ]),

                // About Section
                m(".admin-card", { style: "background: #1a1a1a; padding: 2rem; border-radius: 15px; border: 1px solid #333;" }, [
                    m("h2", { style: "color: #c5a059; margin-bottom: 2rem; border-bottom: 1px solid #333; padding-bottom: 1rem;" }, "About Section"),
                    m(".form-group", [
                        m("label", { style: "display: block; color: #aaa; margin-bottom: 0.5rem;" }, "H2 Title"),
                        m("input", {
                            style: "width: 100%; padding: 1rem; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px; margin-bottom: 1.5rem;",
                            value: content.about?.title || '',
                            oninput: (e: any) => content.about.title = e.target.value
                        }),
                        m("label", { style: "display: block; color: #aaa; margin-bottom: 0.5rem;" }, "Main Description"),
                        m("textarea", {
                            style: "width: 100%; padding: 1rem; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px; margin-bottom: 1.5rem;",
                            rows: 4,
                            value: content.about?.description1 || '',
                            oninput: (e: any) => content.about.description1 = e.target.value
                        }),
                        m("label", { style: "display: block; color: #aaa; margin-bottom: 0.5rem;" }, "Sub Description"),
                        m("textarea", {
                            style: "width: 100%; padding: 1rem; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px;",
                            rows: 4,
                            value: content.about?.description2 || '',
                            oninput: (e: any) => content.about.description2 = e.target.value
                        })
                    ])
                ]),

                // Project Section
                m(".admin-card", { style: "background: #1a1a1a; padding: 2rem; border-radius: 15px; border: 1px solid #333;" }, [
                    m("h2", { style: "color: #c5a059; margin-bottom: 2rem; border-bottom: 1px solid #333; padding-bottom: 1rem;" }, "Active Project"),
                    m(".form-group", [
                        m("label", { style: "display: block; color: #aaa; margin-bottom: 0.5rem;" }, "Project Title"),
                        m("input", {
                            style: "width: 100%; padding: 1rem; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px; margin-bottom: 1.5rem;",
                            value: content.projects?.projectTitle || '',
                            oninput: (e: any) => content.projects.projectTitle = e.target.value
                        }),
                        m("label", { style: "display: block; color: #aaa; margin-bottom: 0.5rem;" }, "Project Description"),
                        m("textarea", {
                            style: "width: 100%; padding: 1rem; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px;",
                            rows: 3,
                            value: content.projects?.projectDescription || '',
                            oninput: (e: any) => content.projects.projectDescription = e.target.value
                        })
                    ])
                ]),

                // Video Section
                m(".admin-card", { style: "background: #1a1a1a; padding: 2rem; border-radius: 15px; border: 1px solid #333;" }, [
                    m("h2", { style: "color: #c5a059; margin-bottom: 2rem; border-bottom: 1px solid #333; padding-bottom: 1rem;" }, "Video Showcase"),
                    m(".form-group", [
                        (content.projects?.videos || []).map((video: string, idx: number) =>
                            m(".video-input-group", { style: "display: flex; gap: 0.5rem; margin-bottom: 1rem;" }, [
                                m("input", {
                                    style: "flex: 1; padding: 0.75rem; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px;",
                                    placeholder: "YouTube URL or ID",
                                    value: video,
                                    oninput: (e: any) => content.projects.videos[idx] = e.target.value
                                }),
                                m("button", {
                                    onclick: () => content.projects.videos.splice(idx, 1),
                                    style: "background: #f44336; color: white; border: none; border-radius: 8px; padding: 0.5rem 1rem; cursor: pointer;"
                                }, "Remove")
                            ])
                        ),
                        m("button", {
                            onclick: () => {
                                if (!content.projects.videos) content.projects.videos = [];
                                content.projects.videos.push("");
                            },
                            style: "width: 100%; padding: 0.75rem; background: transparent; border: 1px dashed #c5a059; color: #c5a059; border-radius: 8px; cursor: pointer; margin-top: 1rem;"
                        }, "+ Add Video")
                    ])
                ])
            ])
        ]);
    }
};

