import m from 'mithril';
import { Navigation } from '../components/Navigation.js';
import { Hero } from '../components/Hero.js';
import { About } from '../components/About.js';
import { Projects } from '../components/Projects.js';
import { Contact } from '../components/Contact.js';
import { Footer } from '../components/Footer.js';

export async function getServerData(request: any) {
    const db = (request.server as any).db;
    if (!db) {
        request.log.warn('[Landing] Database not initialized during SSR');
        return { content: {} };
    }
    try {
        const content = await db.findOne('content', { type: 'landing' });
        request.log.info({ contentFound: !!content }, '[LANDING] getServerData running');
        return { content: content || {} };
    } catch (e) {
        request.log.error(e);
        return { content: {} };
    }
}

export default {
    title: 'Chandra Satria Agung',
    view: function (vnode: any) {
        console.log("[Moria] Rendering LANDING Page");
        // MoriaJS passes getServerData results into attrs.serverData
        const { serverData } = vnode.attrs;
        const content = serverData?.content || {};

        const layoutType = content.layout || 'classic';

        // Base components that are always first and last
        const nav = m(Navigation);
        const hero = m(Hero, { content: content.hero || {} });
        const footer = m(Footer);

        // Dynamic sections
        const about = m(About, { content: content.about || {} });
        const projects = m(Projects, { content: content.projects || {} });
        const contact = m(Contact, { content: content.contact || {} });

        let pageSections;

        switch (layoutType) {
            case 'projects-first':
                pageSections = [projects, about, contact];
                break;
            case 'lead-gen':
                pageSections = [contact, projects, about];
                break;
            case 'about-focused':
                pageSections = [about, contact, projects];
                break;
            case 'classic':
            default:
                pageSections = [about, projects, contact];
                break;
        }

        return [nav, hero, ...pageSections, footer];
    }
};
