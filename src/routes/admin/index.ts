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
        request.log.info({ contentFound: !!content }, '[CMS-ADMIN] getServerData running');
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
        console.log("[Moria-Admin] oninit. Hydrated:", typeof window !== 'undefined');
        vnode.state.content = serverData?.content || {};
        vnode.state.inquiries = [];

        // Ensure nested objects exist
        const ensure = (obj: any) => {
            const out = { ...obj };
            if (!out.hero) out.hero = {};
            if (!out.about) out.about = {};
            if (!out.projects) out.projects = { list: [] };

            // Migration / normalize to list
            if (out.projects && !out.projects.list) {
                out.projects = {
                    sectionTitle: out.projects.sectionTitle || "Active Projects",
                    list: [{
                        projectTitle: out.projects.projectTitle || '',
                        projectDescription: out.projects.projectDescription || '',
                        images: out.projects.images || [],
                        videos: out.projects.videos || [],
                        specsLeft: out.projects.specsLeft || [],
                        specsRight: out.projects.specsRight || []
                    }]
                };
            }

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
        m.redraw(); // Force UI update to show "SAVING..." state
        try {
            await m.request({
                method: "POST",
                url: "/api/content",
                body: vnode.state.content
            });
            toast.success("Changes saved live!");
        } catch (e) {
            console.error('[CMS] Save error:', e);
            toast.error("Failed to save changes");
        } finally {
            vnode.state.saving = false;
            m.redraw();
        }
    },

    uploadImage: async function (vnode: any, projectIdx: number, file: File) {
        console.log("[Moria-Admin] uploadImage called for project", projectIdx, "file", file.name);
        toast.info(`Uploading ${file.name}...`);
        const reader = new FileReader();
        reader.onload = async () => {
            console.log("[Moria-Admin] FileReader.onload triggered");
            const base64 = (reader.result as string).split(',')[1];
            try {
                console.log("[Moria-Admin] Requesting POST /api/media...");
                const response: any = await m.request({
                    method: 'POST',
                    url: '/api/media',
                    body: {
                        filename: file.name,
                        contentType: file.type,
                        data: base64
                    }
                });
                console.log("[Moria-Admin] Response received:", response);
                if (response.success) {
                    const projects = vnode.state.content.projects.list;
                    if (!projects[projectIdx].images) projects[projectIdx].images = [];
                    projects[projectIdx].images.push(response.url);
                    toast.success("Image uploaded!");
                    m.redraw();
                }
            } catch (e) {
                console.error('[CMS] Upload error:', e);
                toast.error("Failed to upload image");
            }
        };
        reader.readAsDataURL(file);
    },

    logout: async function () {
        console.log("[Moria-Admin] Initiating Logout...");
        try {
            const res = await m.request({
                method: 'POST',
                url: '/api/auth/logout'
            });
            console.log("[Moria-Admin] Logout API Response:", res);
        } catch (e) {
            console.error('[Moria-Admin] Logout error:', e);
        }
        console.log("[Moria-Admin] Redirecting to /");
        window.location.href = '/';
    },

    view: function (vnode: any) {
        console.log("[Moria] Rendering ADMIN Page");
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
                m("div", { style: "display: flex; gap: 1rem; align-items: center;" }, [
                    m("a", {
                        href: "/",
                        target: "_blank",
                        style: "color: #aaa; text-decoration: none; font-size: 0.9rem; margin-right: 1rem; border-bottom: 1px solid transparent; transition: 0.3s; padding: 0.5rem 0;",
                        onmouseover: (e: any) => e.target.style.color = '#c5a059',
                        onmouseout: (e: any) => e.target.style.color = '#aaa'
                    }, "← View Site"),
                    m("button", {
                        onclick: () => this.logout(),
                        style: "background: transparent; color: #ff4444; border: 1px solid #ff4444; padding: 0.5rem 1.2rem; border-radius: 8px; cursor: pointer; transition: 0.3s;"
                    }, "LOGOUT"),
                    m("button", {
                        onclick: () => this.save(vnode),
                        disabled: !!saving,
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
                                m("tbody", (vnode.state.inquiries || []).map((inq: any, idx: number) => m("tr", { key: inq._id || idx, style: "border-bottom: 1px solid #222;" }, [
                                    m("td", { style: "padding: 1rem; color: #888; white-space: nowrap;" }, inq.createdAt ? new Date(inq.createdAt).toLocaleDateString() : 'N/A'),
                                    m("td", { style: "padding: 1rem; font-weight: 500;" }, inq.fullName || 'N/A'),
                                    m("td", { style: "padding: 1rem;" }, inq.email ? m("a", { href: `mailto:${inq.email}`, style: "color: #c5a059; text-decoration: none;" }, inq.email) : 'N/A'),
                                    m("td", { style: "padding: 1rem; color: #aaa; max-width: 300px;" }, inq.message || '')
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
                m(".admin-card", { style: "background: #1a1a1a; padding: 2rem; border-radius: 15px; border: 1px solid #333; grid-column: 1 / -1;" }, [
                    m("h2", { style: "color: #c5a059; margin-bottom: 2rem; border-bottom: 1px solid #333; padding-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;" }, [
                        "Active Projects",
                        m("button", {
                            onclick: () => content.projects.list.push({ projectTitle: '', projectDescription: '', images: [], videos: [], specsLeft: [], specsRight: [] }),
                            style: "padding: 0.5rem 1rem; background: #333; color: #fff; border: 1px solid #444; border-radius: 8px; cursor: pointer; font-size: 0.8rem;"
                        }, "+ Add Project")
                    ]),
                    (content.projects.list || []).map((project: any, pIdx: number) => m(".project-editor", { key: pIdx, style: "margin-bottom: 3rem; padding: 1.5rem; background: #111; border-radius: 10px; border: 1px solid #222;" }, [
                        m("header", { style: "display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;" }, [
                            m("h3", { style: "margin: 0; color: #fff;" }, `Project #${pIdx + 1}: ${project.projectTitle || 'Untitled'}`),
                            m("button", {
                                onclick: () => content.projects.list.splice(pIdx, 1),
                                style: "background: #f4433622; color: #f44336; border: 1px solid #f44336; border-radius: 5px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.7rem;"
                            }, "Delete Project")
                        ]),
                        m(".form-row", { style: "display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem; margin-bottom: 1.5rem;" }, [
                            m(".form-group", [
                                m("label", { style: "display: block; color: #aaa; margin-bottom: 0.5rem;" }, "Title"),
                                m("input", {
                                    style: "width: 100%; padding: 0.75rem; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 8px;",
                                    value: project.projectTitle || '',
                                    oninput: (e: any) => project.projectTitle = e.target.value
                                })
                            ]),
                            m(".form-group", [
                                m("label", { style: "display: block; color: #aaa; margin-bottom: 0.5rem;" }, "Description"),
                                m("textarea", {
                                    style: "width: 100%; padding: 0.75rem; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 8px;",
                                    rows: 2,
                                    value: project.projectDescription || '',
                                    oninput: (e: any) => project.projectDescription = e.target.value
                                })
                            ])
                        ]),

                        // Photo Gallery
                        m(".gallery-manager", { style: "margin-bottom: 2rem;" }, [
                            m("label", { style: "display: block; color: #aaa; margin-bottom: 1rem; font-weight: bold;" }, "Photo Gallery"),
                            m(".gallery-grid", { style: "display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1rem;" }, [
                                (project.images || []).map((imgUrl: string, iIdx: number) => m(".gallery-item", { style: "position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #1a1a1a;" }, [
                                    m("img", { src: imgUrl, style: "width: 100%; height: 100%; object-fit: cover;" }),
                                    m("button", {
                                        onclick: () => project.images.splice(iIdx, 1),
                                        style: "position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: #fff; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px;"
                                    }, "✕")
                                ])),
                                m("label.upload-btn", {
                                    style: "aspect-ratio: 1; background: #111; border: 2px dashed #444; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; color: #666; transition: 0.3s;"
                                }, [
                                    m("span", { style: "font-size: 1.5rem;" }, "+"),
                                    m("span", { style: "font-size: 0.7rem;" }, "Upload"),
                                    m("input[type=file][accept=image/*]", {
                                        style: "display: none;",
                                        onchange: (e: any) => {
                                            const file = e.target.files[0];
                                            console.log("[Moria-Admin] input.onchange. File selected:", file?.name);
                                            if (file) this.uploadImage(vnode, pIdx, file);
                                            else console.warn("[Moria-Admin] No file selected in onchange");
                                        }
                                    })
                                ])
                            ])
                        ]),

                        // Video Links
                        m(".video-manager", [
                            m("label", { style: "display: block; color: #aaa; margin-bottom: 1rem; font-weight: bold;" }, "Video Showcase"),
                            (project.videos || []).map((video: string, vIdx: number) =>
                                m(".video-input-group", { style: "display: flex; gap: 0.5rem; margin-bottom: 1rem;" }, [
                                    m("input", {
                                        style: "flex: 1; padding: 0.75rem; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 8px;",
                                        placeholder: "YouTube URL or ID",
                                        value: video,
                                        oninput: (e: any) => project.videos[vIdx] = e.target.value
                                    }),
                                    m("button", {
                                        onclick: () => project.videos.splice(vIdx, 1),
                                        style: "background: transparent; color: #f44336; border: 1px solid #f44336; border-radius: 8px; padding: 0.5rem; cursor: pointer; font-size: 0.7rem;"
                                    }, "Remove")
                                ])
                            ),
                            m("button", {
                                onclick: () => { if (!project.videos) project.videos = []; project.videos.push(""); },
                                style: "width: 100%; padding: 0.75rem; background: transparent; border: 1px dashed #333; color: #888; border-radius: 8px; cursor: pointer; font-size: 0.8rem;"
                            }, "+ Add Video")
                        ])
                    ]))
                ])
            ])
        ]);
    }
}

