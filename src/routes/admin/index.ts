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
    title: 'CSA Admin - Chandra Satria Agung',
    oninit: function (vnode: any) {
        const { serverData } = vnode.attrs;
        vnode.state.content = serverData?.content || {};
        vnode.state.inquiries = [];

        // Ensure nested objects exist
        const ensure = (obj: any) => {
            const out = { ...obj };
            if (!out.hero) out.hero = {};
            if (!out.about) out.about = {};
            if (!out.projects) out.projects = {};
            if (!out.contact) out.contact = {};
            return out;
        };

        const rawContent = serverData?.content;
        vnode.state.loading = !rawContent || Object.keys(rawContent).length === 0 || !rawContent.hero?.title;
        vnode.state.content = ensure(rawContent || {});

        if (typeof window !== 'undefined') {
            const fetchData = async () => {
                try {
                    // Fetch Content
                    if (vnode.state.loading) {
                        const response: any = await m.request({ method: "GET", url: "/api/content" });
                        vnode.state.content = ensure(response || {});
                        vnode.state.loading = false;
                    }

                    // Fetch Inquiries
                    const inqs: any = await m.request({ method: "GET", url: "/api/inquiry" });
                    vnode.state.inquiries = inqs || [];
                } catch (e) {
                    console.error('[CMS] Fetch error:', e);
                    toast.error("Failed to load dashboard data");
                    vnode.state.loading = false;
                } finally {
                    m.redraw();
                }
            };
            fetchData();
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
        document.cookie = "admin_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = '/admin/login';
    },

    view: function (vnode: any) {
        const { content, loading, saving, inquiries } = vnode.state;

        if (loading) {
            return m(".admin-loading", {
                style: "color: #fff; padding: 2rem; background: #111; min-height: 100vh;"
            }, "Initializing CMS...");
        }

        return m(".admin-layout", {
            style: "background: var(--admin-bg, #111); min-height: 100vh; padding: 2rem; color: var(--text-main, #fff); font-family: 'Outfit', sans-serif; transition: var(--transition);"
        }, [
            m(Toaster),
            m("header", { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; border-bottom: 1px solid #333; padding-bottom: 1.5rem;" }, [
                m("div", [
                    m("h1", { style: "color: #c5a059; margin: 0; font-size: 1.8rem;" }, "CSA CMS Admin"),
                    m("p", { style: "color: #888; margin: 0.5rem 0 0; font-size: 0.9rem;" }, "Manage your website content and inquiries")
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
                // Layout Settings
                m(".admin-card", { style: "background: #1a1a1a; padding: 2rem; border-radius: 15px; border: 1px solid #333; grid-column: 1 / -1;" }, [
                    m("h2", { style: "color: #c5a059; margin-bottom: 1.5rem;" }, "Layout Settings"),
                    m(".form-group", [
                        m("label", { style: "display: block; color: #aaa; margin-bottom: 0.5rem;" }, "Landing Page Layout"),
                        m("select", {
                            style: "width: 100%; padding: 1rem; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px; cursor: pointer;",
                            value: content.layout || 'classic',
                            onchange: (e: any) => content.layout = e.target.value
                        }, [
                            m("option", { value: "classic" }, "Classic (Hero → About → Projects → Contact)"),
                            m("option", { value: "projects-first" }, "Projects First (Hero → Projects → About → Contact)"),
                            m("option", { value: "lead-gen" }, "Lead Generation (Hero → Contact → Projects → About)"),
                            m("option", { value: "about-focused" }, "About Focused (Hero → About → Contact → Projects)")
                        ])
                    ])
                ]),

                // Inquiries Section (New)
                m(".admin-card", { style: "background: #1a1a1a; padding: 2rem; border-radius: 15px; border: 1px solid #333; grid-column: 1 / -1;" }, [
                    m("h2", { style: "color: #c5a059; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between;" }, [
                        "Visitor Inquiries",
                        m("span", { style: "font-size: 0.8rem; background: #c5a059; color: #111; padding: 0.2rem 0.6rem; border-radius: 10px;" }, `${inquiries.length} entries`)
                    ]),
                    inquiries.length === 0 ? m("p", { style: "color: #666; font-style: italic;" }, "No inquiries yet...") :
                        m(".table-container", { style: "overflow-x: auto;" },
                            m("table", { style: "width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;" }, [
                                m("thead", m("tr", { style: "color: #888; border-bottom: 1px solid #333;" }, [
                                    m("th", { style: "padding: 1rem;" }, "Date"),
                                    m("th", { style: "padding: 1rem;" }, "Name"),
                                    m("th", { style: "padding: 1rem;" }, "Email"),
                                    m("th", { style: "padding: 1rem;" }, "Message")
                                ])),
                                m("tbody", inquiries.map((inq: any) => m("tr", { style: "border-bottom: 1px solid #222;" }, [
                                    m("td", { style: "padding: 1rem; color: #888; white-space: nowrap;" }, new Date(inq.createdAt).toLocaleDateString()),
                                    m("td", { style: "padding: 1rem; font-weight: 500;" }, inq.fullName),
                                    m("td", { style: "padding: 1rem;" }, m("a", { href: `mailto:${inq.email}`, style: "color: #c5a059; text-decoration: none;" }, inq.email)),
                                    m("td", { style: "padding: 1rem; color: #aaa; max-width: 300px;" }, inq.message)
                                ])))
                            ])
                        )
                ]),

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

