import m from 'mithril';
import { Navigation } from '../../components/Navigation.js';
import { Hero } from '../../components/Hero.js';
import { About } from '../../components/About.js';
import { Projects } from '../../components/Projects.js';
import { Contact } from '../../components/Contact.js';
import { Footer } from '../../components/Footer.js';

export async function getServerData(request: any) {
    const db = (request.server as any).db;
    if (!db) {
        request.log.warn('[Landing] Database not initialized during SSR');
        return { content: {} };
    }
    try {
        const content = await db.findOne('content', { type: 'landing' });
        return { content: content || {} };
    } catch (e) {
        request.log.error(e);
        return { content: {} };
    }
}

export default {
    title: 'Chandra Satria Agung',
    view: function (vnode: any) {
        // MoriaJS passes getServerData results into attrs.serverData
        const { serverData } = vnode.attrs;
        const content = serverData?.content || {};

        return [
            m(Navigation),
            m(Hero, { content: content.hero || {} }),
            m(About, { content: content.about || {} }),
            m(Projects, { content: content.projects || {} }),
            m(Contact, { content: content.contact || {} }),
            m(Footer)
        ];
    }
};
